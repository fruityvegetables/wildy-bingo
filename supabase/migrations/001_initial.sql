-- Wilderness Bingo schema (run once in Supabase SQL editor or via CLI)

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-zA-Z0-9_]{3,20}$')
);

create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));

create table if not exists public.rate_limit_events (
  id bigint generated always as identity primary key,
  bucket text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_events_bucket_created_idx
  on public.rate_limit_events (bucket, created_at desc);

create table if not exists public.games (
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

create unique index if not exists games_join_code_idx on public.games (join_code);

create table if not exists public.game_players (
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

create index if not exists game_players_game_id_idx on public.game_players (game_id);

create table if not exists public.tile_marks (
  id uuid primary key default gen_random_uuid(),
  game_player_id uuid not null references public.game_players (id) on delete cascade,
  row int not null check (row >= 0),
  col int not null check (col >= 0),
  marked boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (game_player_id, row, col)
);

create index if not exists tile_marks_player_idx on public.tile_marks (game_player_id);

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.tile_marks enable row level security;
alter table public.rate_limit_events enable row level security;

create policy "Profiles readable by authenticated users"
  on public.profiles for select to authenticated using (true);

create policy "Users update own profile"
  on public.profiles for update to authenticated using (id = auth.uid());

-- Helper functions and game RPCs: see full migration if already partially applied.
-- Edge Functions use service role for rate_limit_events (bypasses RLS).
