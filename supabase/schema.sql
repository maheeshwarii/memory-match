
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Player'
    check (char_length(display_name) between 1 and 20),
  created_at timestamptz not null default now()
);

create table if not exists public.game_sessions (
  id bigint generated always as identity primary key,
  player_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  board_size integer not null check (board_size in (8, 16, 32)),
  moves integer not null check (moves > 0),
  time_seconds integer not null check (time_seconds >= 0),
  accuracy numeric(5,2) not null check (accuracy between 0 and 100),
  completed boolean not null default true,
  played_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.game_sessions enable row level security;

create policy "Players read own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "Players create own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "Players update own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Players read own sessions"
on public.game_sessions for select
to authenticated
using ((select auth.uid()) = player_id);

create policy "Players save own sessions"
on public.game_sessions for insert
to authenticated
with check ((select auth.uid()) = player_id);
