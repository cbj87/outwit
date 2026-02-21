-- ============================================================
-- 001_initial_schema.sql
-- Core tables for Outwit Open
-- ============================================================

-- ----------------------------------------------------------------
-- PROFILES
-- Extends auth.users. Created automatically via trigger below.
-- ----------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text not null,
  email           text not null,
  is_commissioner boolean not null default false,
  avatar_url      text,
  push_token      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------------
-- SEASON CONFIG
-- Single-row table. id = 1 enforced by CHECK constraint.
-- ----------------------------------------------------------------
create table public.season_config (
  id               int primary key default 1 check (id = 1),
  picks_deadline   timestamptz not null default '2026-03-01 20:00:00-05',
  picks_revealed   boolean not null default false,
  current_episode  int not null default 0,
  season_name      text not null default 'Survivor Season 50'
);

-- Insert the single config row
insert into public.season_config (id) values (1);

-- ----------------------------------------------------------------
-- CASTAWAYS
-- 24 rows, seeded in 003_seed_castaways.sql
-- ----------------------------------------------------------------
create table public.castaways (
  id                serial primary key,
  name              text not null,
  original_tribe    text not null,
  current_tribe     text not null,
  photo_url         text,
  is_active         boolean not null default true,
  boot_order        int,
  final_placement   text check (
    final_placement in ('winner', 'runner_up', '3rd', 'jury', 'pre_merge', 'first_boot')
    or final_placement is null
  ),
  created_at        timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- PICKS
-- One row per player. Locked at deadline.
-- ----------------------------------------------------------------
create table public.picks (
  id               uuid primary key default gen_random_uuid(),
  player_id        uuid not null references public.profiles(id) on delete cascade,
  trio_castaway_1  int not null references public.castaways(id),
  trio_castaway_2  int not null references public.castaways(id),
  trio_castaway_3  int not null references public.castaways(id),
  icky_castaway    int not null references public.castaways(id),
  submitted_at     timestamptz not null default now(),
  is_locked        boolean not null default false,
  unique(player_id)
);

-- ----------------------------------------------------------------
-- PROPHECY ANSWERS
-- 16 yes/no answers per player.
-- ----------------------------------------------------------------
create table public.prophecy_answers (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references public.profiles(id) on delete cascade,
  question_id  int not null check (question_id between 1 and 16),
  answer       boolean not null,
  unique(player_id, question_id)
);

-- ----------------------------------------------------------------
-- EPISODES
-- One row per episode, created by commissioner.
-- ----------------------------------------------------------------
create table public.episodes (
  id              serial primary key,
  episode_number  int not null unique,
  air_date        date,
  title           text,
  is_finalized    boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- CASTAWAY EVENTS
-- Core scoring input. Commissioner logs after each episode.
-- ----------------------------------------------------------------
create table public.castaway_events (
  id           uuid primary key default gen_random_uuid(),
  episode_id   int not null references public.episodes(id) on delete cascade,
  castaway_id  int not null references public.castaways(id) on delete cascade,
  event_type   text not null check (event_type in (
    'idol_found',
    'advantage_found',
    'idol_played_correct',
    'idol_played_incorrect',
    'shot_in_dark_success',
    'shot_in_dark_fail',
    'fire_making_win',
    'individual_immunity_win',
    'individual_reward_win',
    'final_immunity_win',
    'made_jury',
    'placed_3rd',
    'placed_runner_up',
    'sole_survivor',
    'first_boot',
    'voted_out_with_idol',
    'voted_out_with_advantage',
    'voted_out_unanimously',
    'quit',
    'survived_episode'
  )),
  created_at   timestamptz not null default now(),
  unique(episode_id, castaway_id, event_type)
);

-- ----------------------------------------------------------------
-- PROPHECY OUTCOMES
-- Commissioner sets true/false as the season progresses.
-- 16 rows seeded in 004_seed_prophecy.sql
-- ----------------------------------------------------------------
create table public.prophecy_outcomes (
  question_id  int primary key check (question_id between 1 and 16),
  outcome      boolean,           -- null = not yet resolved
  resolved_at  timestamptz,
  updated_by   uuid references public.profiles(id)
);

-- ----------------------------------------------------------------
-- SCORE CACHE
-- Pre-computed totals per player. Written by calculate-scores Edge Function.
-- ----------------------------------------------------------------
create table public.score_cache (
  player_id           uuid primary key references public.profiles(id) on delete cascade,
  trio_points         int not null default 0,
  icky_points         int not null default 0,
  prophecy_points     int not null default 0,
  total_points        int not null default 0,
  last_calculated_at  timestamptz not null default now()
);

-- Enable Realtime on score_cache and season_config
-- (run after table creation; requires REPLICA IDENTITY FULL)
alter table public.score_cache replica identity full;
alter table public.season_config replica identity full;

-- ----------------------------------------------------------------
-- SCORE CACHE TRIO DETAIL
-- Per-castaway breakdown for My Picks drill-down view.
-- ----------------------------------------------------------------
create table public.score_cache_trio_detail (
  player_id     uuid not null references public.profiles(id) on delete cascade,
  castaway_id   int not null references public.castaways(id) on delete cascade,
  points_earned int not null default 0,
  primary key (player_id, castaway_id)
);
