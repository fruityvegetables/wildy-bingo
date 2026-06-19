-- Fix RLS infinite recursion (500 on GET /game_players, /games, /tile_marks).
-- Run in Supabase SQL editor if game views stuck on "Loading game…"

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
