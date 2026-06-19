-- Run after 001_initial.sql (safe to re-run: CREATE OR REPLACE / IF NOT EXISTS)

-- ---------------------------------------------------------------------------
-- Schema additions
-- ---------------------------------------------------------------------------

alter table public.game_players
  add column if not exists won_at timestamptz;

create or replace function public.is_game_participant(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.game_players
    where game_id = p_game_id and user_id = auth.uid()
  )
  or exists (
    select 1
    from public.games
    where id = p_game_id and host_id = auth.uid()
  );
$$;

grant execute on function public.is_game_participant(uuid) to authenticated;

create table if not exists public.game_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  player_id uuid references public.game_players (id) on delete set null,
  event_type text not null check (event_type in ('bingo_win', 'match_ended')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists game_events_game_id_created_idx
  on public.game_events (game_id, created_at desc);

alter table public.game_events enable row level security;

drop policy if exists "Game events readable by game participants" on public.game_events;
create policy "Game events readable by game participants"
  on public.game_events for select to authenticated
  using (public.is_game_participant(game_id));

-- Realtime (ignore error if already added)
do $$
begin
  alter publication supabase_realtime add table public.game_events;
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.generate_join_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  loop
    result := '';
    for i in 1..6 loop
      result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.games where join_code = result);
  end loop;
  return result;
end;
$$;

create or replace function public.shuffle_board_grid(p_grid jsonb, p_size int)
returns jsonb
language plpgsql
as $$
declare
  vals text[] := array[]::text[];
  rows int[] := array[]::int[];
  cols int[] := array[]::int[];
  r int;
  c int;
  i int;
  j int;
  tmp text;
  result jsonb := p_grid;
  mid int;
begin
  mid := p_size / 2;

  for r in 0..(p_size - 1) loop
    for c in 0..(p_size - 1) loop
      if p_size % 2 = 1 and r = mid and c = mid then
        continue;
      end if;
      vals := vals || coalesce(p_grid->r->>c, '');
      rows := rows || r;
      cols := cols || c;
    end loop;
  end loop;

  for i in reverse coalesce(array_length(vals, 1), 0)..2 loop
    j := 1 + floor(random() * i)::int;
    tmp := vals[i];
    vals[i] := vals[j];
    vals[j] := tmp;
  end loop;

  for i in 1..coalesce(array_length(vals, 1), 0) loop
    result := jsonb_set(
      result,
      array[rows[i]::text, cols[i]::text],
      to_jsonb(vals[i]),
      true
    );
  end loop;

  return result;
end;
$$;

create or replace function public.player_has_bingo(p_player_id uuid, p_size int)
returns boolean
language plpgsql
stable
as $$
declare
  marked boolean[][];
  r int;
  c int;
  mid int;
  complete boolean;
begin
  marked := array_fill(false, array[p_size, p_size]);

  if p_size % 2 = 1 then
    mid := p_size / 2;
    marked[mid + 1][mid + 1] := true;
  end if;

  for r, c in
    select tm.row, tm.col
    from public.tile_marks tm
    where tm.game_player_id = p_player_id and tm.marked = true
  loop
    if r between 0 and p_size - 1 and c between 0 and p_size - 1 then
      marked[r + 1][c + 1] := true;
    end if;
  end loop;

  for r in 1..p_size loop
    complete := true;
    for c in 1..p_size loop
      if not marked[r][c] then complete := false; exit; end if;
    end loop;
    if complete then return true; end if;
  end loop;

  for c in 1..p_size loop
    complete := true;
    for r in 1..p_size loop
      if not marked[r][c] then complete := false; exit; end if;
    end loop;
    if complete then return true; end if;
  end loop;

  complete := true;
  for r in 1..p_size loop
    if not marked[r][r] then complete := false; exit; end if;
  end loop;
  if complete then return true; end if;

  complete := true;
  for r in 1..p_size loop
    if not marked[r][p_size - r + 1] then complete := false; exit; end if;
  end loop;

  return complete;
end;
$$;

-- ---------------------------------------------------------------------------
-- Game RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_game(
  p_name text,
  p_board_size int,
  p_host_grid jsonb,
  p_item_text text default '',
  p_require_approval boolean default false
)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_game public.games;
  v_host_name text;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select username into v_host_name from public.profiles where id = v_user;

  insert into public.games (host_id, join_code, name, board_size, host_grid, item_text, require_approval)
  values (
    v_user,
    public.generate_join_code(),
    coalesce(nullif(trim(p_name), ''), 'Wilderness Bingo'),
    p_board_size,
    p_host_grid,
    coalesce(p_item_text, ''),
    coalesce(p_require_approval, false)
  )
  returning * into v_game;

  insert into public.game_players (game_id, user_id, display_name, status, board_grid)
  values (v_game.id, v_user, coalesce(v_host_name, 'Host'), 'approved', p_host_grid);

  return v_game;
end;
$$;

create or replace function public.join_game(p_join_code text)
returns public.game_players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_game public.games;
  v_player public.game_players;
  v_name text;
  v_status text;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select * into v_game
  from public.games
  where join_code = upper(trim(p_join_code)) and status = 'lobby';

  if not found then raise exception 'Invalid join code or game already started'; end if;

  if exists (
    select 1 from public.game_players
    where game_id = v_game.id and user_id = v_user and status != 'kicked'
  ) then
    raise exception 'Already in this game';
  end if;

  select username into v_name from public.profiles where id = v_user;
  v_status := case when v_game.require_approval then 'pending' else 'approved' end;

  insert into public.game_players (game_id, user_id, display_name, status, board_grid)
  values (v_game.id, v_user, coalesce(v_name, 'Player'), v_status, v_game.host_grid)
  returning * into v_player;

  return v_player;
end;
$$;

create or replace function public.update_host_board(
  p_game_id uuid,
  p_name text,
  p_board_size int,
  p_host_grid jsonb,
  p_item_text text default '',
  p_require_approval boolean default false
)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games;
begin
  select * into v_game from public.games where id = p_game_id for update;

  if v_game.host_id != auth.uid() then raise exception 'Host only'; end if;
  if v_game.status != 'lobby' then raise exception 'Game already started'; end if;

  update public.games
  set
    name = coalesce(nullif(trim(p_name), ''), name),
    board_size = p_board_size,
    host_grid = p_host_grid,
    item_text = coalesce(p_item_text, ''),
    require_approval = coalesce(p_require_approval, require_approval)
  where id = p_game_id
  returning * into v_game;

  update public.game_players
  set board_grid = p_host_grid
  where game_id = p_game_id and status in ('approved', 'pending');

  return v_game;
end;
$$;

create or replace function public.start_game(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games;
  v_player record;
begin
  select * into v_game from public.games where id = p_game_id for update;

  if v_game.host_id != auth.uid() then raise exception 'Host only'; end if;
  if v_game.status != 'lobby' then raise exception 'Game already started'; end if;

  if not exists (
    select 1 from public.game_players
    where game_id = p_game_id and status = 'approved'
  ) then
    raise exception 'Need at least one approved player';
  end if;

  for v_player in
    select id from public.game_players
    where game_id = p_game_id and status = 'approved'
  loop
    update public.game_players
    set
      status = 'playing',
      board_grid = public.shuffle_board_grid(v_game.host_grid, v_game.board_size)
    where id = v_player.id;
  end loop;

  update public.games
  set status = 'live', locked_at = now()
  where id = p_game_id
  returning * into v_game;

  return v_game;
end;
$$;

create or replace function public.approve_player(p_player_id uuid)
returns public.game_players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player public.game_players;
  v_game public.games;
begin
  select gp.* into v_player from public.game_players gp where gp.id = p_player_id;
  if not found then raise exception 'Player not found'; end if;

  select * into v_game from public.games where id = v_player.game_id;
  if v_game.host_id != auth.uid() then raise exception 'Host only'; end if;
  if v_game.status != 'lobby' then raise exception 'Game already started'; end if;

  update public.game_players
  set status = 'approved'
  where id = p_player_id and status = 'pending'
  returning * into v_player;

  return v_player;
end;
$$;

create or replace function public.kick_player(p_player_id uuid)
returns public.game_players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player public.game_players;
  v_game public.games;
begin
  select gp.* into v_player from public.game_players gp where gp.id = p_player_id;
  if not found then raise exception 'Player not found'; end if;

  select * into v_game from public.games where id = v_player.game_id;
  if v_game.host_id != auth.uid() then raise exception 'Host only'; end if;

  update public.game_players
  set status = 'kicked'
  where id = p_player_id
  returning * into v_player;

  return v_player;
end;
$$;

create or replace function public.toggle_tile_mark(p_game_id uuid, p_row int, p_col int)
returns public.tile_marks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_game public.games;
  v_player public.game_players;
  v_mark public.tile_marks;
begin
  select * into v_game from public.games where id = p_game_id;
  if v_game.status != 'live' then raise exception 'Game is not live'; end if;

  select * into v_player
  from public.game_players
  where game_id = p_game_id and user_id = v_user and status = 'playing';

  if not found then raise exception 'Not an active player'; end if;

  select * into v_mark
  from public.tile_marks
  where game_player_id = v_player.id and row = p_row and col = p_col;

  if found then
    if v_mark.marked then
      delete from public.tile_marks where id = v_mark.id;
      return null;
    end if;
    update public.tile_marks set marked = true, updated_at = now()
    where id = v_mark.id returning * into v_mark;
    return v_mark;
  end if;

  insert into public.tile_marks (game_player_id, row, col, marked)
  values (v_player.id, p_row, p_col, true)
  returning * into v_mark;

  return v_mark;
end;
$$;

create or replace function public.report_bingo_win(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_player public.game_players;
  v_game public.games;
  v_last_event timestamptz;
  v_event_id uuid;
begin
  select * into v_game from public.games where id = p_game_id;
  if v_game.status != 'live' then
    raise exception 'Game is not live';
  end if;

  select * into v_player
  from public.game_players
  where game_id = p_game_id and user_id = v_user and status = 'playing';

  if not found then raise exception 'Not an active player'; end if;

  if not public.player_has_bingo(v_player.id, v_game.board_size) then
    raise exception 'No bingo yet';
  end if;

  select ge.created_at into v_last_event
  from public.game_events ge
  where ge.game_id = p_game_id
    and ge.player_id = v_player.id
    and ge.event_type = 'bingo_win'
  order by ge.created_at desc
  limit 1;

  if v_last_event is not null and v_last_event > now() - interval '5 seconds' then
    return jsonb_build_object(
      'celebration', false,
      'reason', 'rate_limited',
      'won_at', v_player.won_at,
      'display_name', v_player.display_name
    );
  end if;

  if v_player.won_at is null then
    update public.game_players set won_at = now() where id = v_player.id;
    v_player.won_at := now();
  end if;

  insert into public.game_events (game_id, player_id, event_type, payload)
  values (
    p_game_id,
    v_player.id,
    'bingo_win',
    jsonb_build_object('display_name', v_player.display_name)
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'celebration', true,
    'event_id', v_event_id,
    'won_at', v_player.won_at,
    'display_name', v_player.display_name
  );
end;
$$;

create or replace function public.end_match(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games;
begin
  select * into v_game from public.games where id = p_game_id for update;

  if v_game.host_id != auth.uid() then raise exception 'Host only'; end if;
  if v_game.status != 'live' then raise exception 'Game is not live'; end if;

  update public.games set status = 'ended' where id = p_game_id returning * into v_game;

  insert into public.game_events (game_id, event_type, payload)
  values (p_game_id, 'match_ended', '{}'::jsonb);

  return v_game;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS for games / players / marks (security definer helper avoids 500 recursion)
-- ---------------------------------------------------------------------------

create or replace function public.is_game_participant(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.game_players
    where game_id = p_game_id and user_id = auth.uid()
  )
  or exists (
    select 1
    from public.games
    where id = p_game_id and host_id = auth.uid()
  );
$$;

grant execute on function public.is_game_participant(uuid) to authenticated;

drop policy if exists "Games readable by participants" on public.games;
create policy "Games readable by participants"
  on public.games for select to authenticated
  using (public.is_game_participant(id));

drop policy if exists "Game players readable in same game" on public.game_players;
create policy "Game players readable in same game"
  on public.game_players for select to authenticated
  using (public.is_game_participant(game_id));

drop policy if exists "Tile marks readable in same game" on public.tile_marks;
create policy "Tile marks readable in same game"
  on public.tile_marks for select to authenticated
  using (
    exists (
      select 1
      from public.game_players gp
      where gp.id = tile_marks.game_player_id
        and public.is_game_participant(gp.game_id)
    )
  );

drop policy if exists "Game events readable by game participants" on public.game_events;
create policy "Game events readable by game participants"
  on public.game_events for select to authenticated
  using (public.is_game_participant(game_id));

grant execute on function public.create_game to authenticated;
grant execute on function public.join_game to authenticated;
grant execute on function public.update_host_board to authenticated;
grant execute on function public.start_game to authenticated;
grant execute on function public.approve_player to authenticated;
grant execute on function public.kick_player to authenticated;
grant execute on function public.toggle_tile_mark to authenticated;
grant execute on function public.report_bingo_win to authenticated;
grant execute on function public.end_match to authenticated;
