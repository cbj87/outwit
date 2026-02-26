-- ============================================================
-- 013_episode_seen_status.sql
-- Spoiler protection: per-player episode seen tracking
-- and per-episode score snapshots for spoiler-safe leaderboard.
-- ============================================================

-- ----------------------------------------------------------------
-- SCORE SNAPSHOTS
-- Cumulative scores captured at each episode finalization.
-- Written by the calculate-scores Edge Function (service role).
-- ----------------------------------------------------------------
create table if not exists public.score_snapshots (
  player_id  uuid        not null,
  group_id   uuid        not null references public.groups(id) on delete cascade,
  episode_number int     not null,
  trio_points    int     not null default 0,
  icky_points    int     not null default 0,
  prophecy_points int    not null default 0,
  total_points   int     not null default 0,
  created_at timestamptz not null default now(),
  primary key (player_id, group_id, episode_number)
);

alter table public.score_snapshots enable row level security;

create policy "Anyone authenticated can read score snapshots"
  on public.score_snapshots for select
  to authenticated
  using (true);

-- No user-facing insert/update/delete — handled by Edge Function via service role

-- ----------------------------------------------------------------
-- EPISODE SEEN STATUS
-- Tracks which episodes each player has marked as "seen."
-- Players insert/delete their own rows.
-- ----------------------------------------------------------------
create table if not exists public.episode_seen_status (
  player_id      uuid    not null references auth.users(id) on delete cascade,
  episode_number int     not null,
  seen_at        timestamptz not null default now(),
  primary key (player_id, episode_number)
);

alter table public.episode_seen_status enable row level security;

create policy "Players can read own seen status"
  on public.episode_seen_status for select
  to authenticated
  using (player_id = auth.uid());

create policy "Players can mark episodes as seen"
  on public.episode_seen_status for insert
  to authenticated
  with check (player_id = auth.uid());

create policy "Players can unmark episodes"
  on public.episode_seen_status for delete
  to authenticated
  using (player_id = auth.uid());
