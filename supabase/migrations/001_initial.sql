-- Wilderness Bingo: multiplayer schema

create extension if not exists "pgcrypto";

-- Profiles (username auth; Supabase auth email is synthetic)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-zA-Z0-9_]{3,20}$')
);

create unique index profiles_username_lower_idx on public.profiles (lower(username));

-- Rate limit audit log (used by Edge Functions)
create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  bucket text not null,
  created_at timestamptz not null default now()
);

create index rate_limit_events_bucket_created_idx
  on public.rate_limit_events (bucket, created_at desc);

-- Games
create table public.games (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  join_code text not null,
  name text not null default 'Wilderness Bingo',
  status text not null default 'lobby'
    check (status in ('lobby', 'live', 'ended')),
  board_size int not null check (board_size between 5 and 7),
  host_grid jsonb not null,
  item_text text not null default '',
  require_approval boolean not null default false,
  locked_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index games_join_code_idx on public.games (join_code);

-- Players in a game
create table public.game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  display_name text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'playing', 'kicked')),
  board_grid jsonb not null,
  joined_at timestamptz not null default now(),
  unique (game_id, user_id)
);

create index game_players_game_id_idx on public.game_players (game_id);

-- Realtime tile marks (only mutable data after lock)
create table public.tile_marks (
  id uuid primary key default gen_random_uuid(),
  game_player_id uuid not null references public.game_players (id) on delete cascade,
  row int not null check (row >= 0),
  col int not null check (col >= 0),
  marked boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (game_player_id, row, col)
);

create index tile_marks_player_idx on public.tile_marks (game_player_id);

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
  for i in 1..6 loop
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.is_game_host(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.games g
    where g.id = p_game_id and g.host_id = auth.uid()
  );
$$;

create or replace function public.is_game_member(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_game_host(p_game_id)
    or exists (
      select 1 from public.game_players gp
      where gp.game_id = p_game_id
        and gp.user_id = auth.uid()
        and gp.status <> 'kicked'
    );
$$;

create or replace function public.my_game_player_id(p_game_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select gp.id from public.game_players gp
  where gp.game_id = p_game_id and gp.user_id = auth.uid()
  limit 1;
$$;

-- Auto-create profile on signup (service role / trigger)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

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
  v_code text;
  v_game public.games;
  v_attempts int := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_board_size < 5 or p_board_size > 7 then
    raise exception 'Board size must be 5–7';
  end if;

  loop
    v_code := public.generate_join_code();
    begin
      insert into public.games (
        host_id, join_code, name, board_size, host_grid, item_text, require_approval
      ) values (
        auth.uid(),
        v_code,
        coalesce(nullif(trim(p_name), ''), 'Wilderness Bingo'),
        p_board_size,
        p_host_grid,
        coalesce(p_item_text, ''),
        coalesce(p_require_approval, false)
      )
      returning * into v_game;
      exit;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts > 20 then
        raise exception 'Could not generate join code';
      end if;
    end;
  end loop;

  return v_game;
end;
$$;

create or replace function public.update_host_board(
  p_game_id uuid,
  p_name text,
  p_board_size int,
  p_host_grid jsonb,
  p_item_text text,
  p_require_approval boolean
)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games;
begin
  if not public.is_game_host(p_game_id) then
    raise exception 'Only the host can edit the board';
  end if;

  select * into v_game from public.games where id = p_game_id for update;

  if v_game.status <> 'lobby' then
    raise exception 'Board is locked';
  end if;

  update public.games set
    name = coalesce(nullif(trim(p_name), ''), name),
    board_size = p_board_size,
    host_grid = p_host_grid,
    item_text = coalesce(p_item_text, ''),
    require_approval = coalesce(p_require_approval, require_approval)
  where id = p_game_id
  returning * into v_game;

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
  v_game public.games;
  v_player public.game_players;
  v_username text;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_game
  from public.games
  where join_code = upper(trim(p_join_code));

  if v_game.id is null then
    raise exception 'Invalid join code';
  end if;

  if v_game.status <> 'lobby' then
    raise exception 'Game already started';
  end if;

  if v_game.host_id = auth.uid() then
    raise exception 'Host cannot join as a player';
  end if;

  if exists (
    select 1 from public.game_players
    where game_id = v_game.id and user_id = auth.uid() and status = 'kicked'
  ) then
    raise exception 'You were removed from this game';
  end if;

  select username into v_username from public.profiles where id = auth.uid();

  v_status := case when v_game.require_approval then 'pending' else 'approved' end;

  insert into public.game_players (game_id, user_id, display_name, status, board_grid)
  values (v_game.id, auth.uid(), v_username, v_status, v_game.host_grid)
  on conflict (game_id, user_id) do update set
    status = case
      when public.game_players.status = 'kicked' then public.game_players.status
      else excluded.status
    end,
    display_name = excluded.display_name
  returning * into v_player;

  if v_player.status = 'kicked' then
    raise exception 'You were removed from this game';
  end if;

  return v_player;
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
  select * into v_game from public.games where id = v_player.game_id;

  if not public.is_game_host(v_game.id) then
    raise exception 'Only the host can approve players';
  end if;

  if v_game.status <> 'lobby' then
    raise exception 'Game already started';
  end if;

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
  select * into v_game from public.games where id = v_player.game_id;

  if not public.is_game_host(v_game.id) then
    raise exception 'Only the host can kick players';
  end if;

  if v_player.user_id = v_game.host_id then
    raise exception 'Cannot kick the host';
  end if;

  update public.game_players set status = 'kicked' where id = p_player_id
  returning * into v_player;

  delete from public.tile_marks where game_player_id = p_player_id;

  return v_player;
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
begin
  if not public.is_game_host(p_game_id) then
    raise exception 'Only the host can start the game';
  end if;

  select * into v_game from public.games where id = p_game_id for update;

  if v_game.status <> 'lobby' then
    raise exception 'Game already started';
  end if;

  update public.game_players
  set status = 'playing',
      board_grid = v_game.host_grid
  where game_id = p_game_id
    and status = 'approved';

  update public.games
  set status = 'live', locked_at = now()
  where id = p_game_id
  returning * into v_game;

  return v_game;
end;
$$;

create or replace function public.toggle_tile_mark(
  p_game_id uuid,
  p_row int,
  p_col int
)
returns public.tile_marks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games;
  v_player_id uuid;
  v_mark public.tile_marks;
  v_existing boolean;
begin
  select * into v_game from public.games where id = p_game_id;

  if v_game.status <> 'live' then
    raise exception 'Game is not live';
  end if;

  v_player_id := public.my_game_player_id(p_game_id);

  if v_player_id is null then
    raise exception 'Not a player in this game';
  end if;

  select marked into v_existing
  from public.tile_marks
  where game_player_id = v_player_id and row = p_row and col = p_col;

  if v_existing is true then
    delete from public.tile_marks
    where game_player_id = v_player_id and row = p_row and col = p_col
    returning * into v_mark;
    return v_mark;
  end if;

  insert into public.tile_marks (game_player_id, row, col, marked)
  values (v_player_id, p_row, p_col, true)
  on conflict (game_player_id, row, col)
  do update set marked = true, updated_at = now()
  returning * into v_mark;

  return v_mark;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.tile_marks enable row level security;
alter table public.rate_limit_events enable row level security;

create policy "Profiles are readable by authenticated users"
  on public.profiles for select to authenticated using (true);

create policy "Users update own profile"
  on public.profiles for update to authenticated using (id = auth.uid());

create policy "Games readable by members"
  on public.games for select to authenticated
  using (public.is_game_member(id));

create policy "Host updates game in lobby"
  on public.games for update to authenticated
  using (host_id = auth.uid() and status = 'lobby');

create policy "Game players readable by members"
  on public.game_players for select to authenticated
  using (public.is_game_member(game_id));

create policy "Tile marks readable by game members"
  on public.tile_marks for select to authenticated
  using (
    exists (
      select 1 from public.game_players gp
      where gp.id = tile_marks.game_player_id
        and public.is_game_member(gp.game_id)
    )
  );

-- Realtime
alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.game_players;
alter publication supabase_realtime add table public.tile_marks;

grant execute on function public.create_game to authenticated;
grant execute on function public.update_host_board to authenticated;
grant execute on function public.join_game to authenticated;
grant execute on function public.approve_player to authenticated;
grant execute on function public.kick_player to authenticated;
grant execute on function public.start_game to authenticated;
grant execute on function public.toggle_tile_mark to authenticated;
