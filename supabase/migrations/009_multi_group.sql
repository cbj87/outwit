-- ============================================================
-- 009_multi_group.sql
-- Add multi-group support. Groups determine who you compete
-- against. Picks and prophecy answers are per-player (global).
-- Scores are per-player-per-group since rankings depend on
-- group membership. Castaways, episodes, events, and prophecy
-- outcomes stay global.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. NEW TABLES
-- ----------------------------------------------------------------

-- Groups table — each group is a separate fantasy league
create table public.groups (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  invite_code     text not null unique,
  created_by      uuid not null references public.profiles(id),
  picks_deadline  timestamptz not null default '2026-03-01 20:00:00-05',
  picks_revealed  boolean not null default false,
  current_episode int not null default 0,
  created_at      timestamptz not null default now()
);

-- Group members join table
create table public.group_members (
  group_id   uuid not null references public.groups(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- Enable RLS
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- Realtime for groups (so UI updates when commissioner changes settings)
alter table public.groups replica identity full;

-- ----------------------------------------------------------------
-- 2. RLS HELPER FUNCTIONS
-- ----------------------------------------------------------------

create or replace function public.is_group_commissioner(gid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.groups
    where id = gid and created_by = auth.uid()
  );
$$;

create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------
-- 3. GROUPS RLS POLICIES
-- ----------------------------------------------------------------

-- Anyone authenticated can read groups (needed for invite code lookup)
create policy "Authenticated users can read groups"
  on public.groups for select
  to authenticated
  using (true);

-- Any authenticated user can create a group
create policy "Authenticated users can create groups"
  on public.groups for insert
  to authenticated
  with check (created_by = auth.uid());

-- Group commissioner can update their group
create policy "Commissioner can update own group"
  on public.groups for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- ----------------------------------------------------------------
-- 4. GROUP_MEMBERS RLS POLICIES
-- ----------------------------------------------------------------

-- Members can see who is in their groups
create policy "Members can read group members"
  on public.group_members for select
  to authenticated
  using (public.is_group_member(group_id));

-- Users can join groups (insert their own row)
create policy "Users can join groups"
  on public.group_members for insert
  to authenticated
  with check (user_id = auth.uid());

-- Users can leave groups (delete their own row)
create policy "Users can leave groups"
  on public.group_members for delete
  to authenticated
  using (user_id = auth.uid());

-- Group commissioner can remove members
create policy "Commissioner can remove members"
  on public.group_members for delete
  to authenticated
  using (public.is_group_commissioner(group_id));

-- ----------------------------------------------------------------
-- 5. ADD active_group_id TO PROFILES
-- ----------------------------------------------------------------

alter table public.profiles
  add column active_group_id uuid references public.groups(id) on delete set null;

-- ----------------------------------------------------------------
-- 6. ADD group_id TO SCORE TABLES ONLY (nullable first for backfill)
-- Picks and prophecy_answers stay per-player — no group_id needed.
-- ----------------------------------------------------------------

alter table public.score_cache
  add column group_id uuid references public.groups(id) on delete cascade;

alter table public.score_cache_trio_detail
  add column group_id uuid references public.groups(id) on delete cascade;

-- ----------------------------------------------------------------
-- 7. DATA MIGRATION — Create default group and backfill
-- ----------------------------------------------------------------

do $$
declare
  default_group_id uuid;
  commissioner_id uuid;
  cfg record;
begin
  -- Find the commissioner (or fall back to any user)
  select id into commissioner_id
    from public.profiles
    where is_commissioner = true
    limit 1;

  if commissioner_id is null then
    select id into commissioner_id
      from public.profiles
      limit 1;
  end if;

  -- Skip migration if no users exist yet
  if commissioner_id is null then
    return;
  end if;

  -- Get season config values
  select * into cfg from public.season_config where id = 1;

  -- Create the default group
  default_group_id := gen_random_uuid();
  insert into public.groups (id, name, invite_code, created_by, picks_deadline, picks_revealed, current_episode)
  values (
    default_group_id,
    'Outwit Testers',
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 6),
    commissioner_id,
    coalesce(cfg.picks_deadline, '2026-03-01 20:00:00-05'),
    coalesce(cfg.picks_revealed, false),
    coalesce(cfg.current_episode, 0)
  );

  -- Add all existing profiles as members of the default group
  insert into public.group_members (group_id, user_id)
  select default_group_id, id from public.profiles;

  -- Backfill group_id on score tables
  update public.score_cache set group_id = default_group_id where group_id is null;
  update public.score_cache_trio_detail set group_id = default_group_id where group_id is null;

  -- Set active_group_id on all profiles
  update public.profiles set active_group_id = default_group_id;
end $$;

-- ----------------------------------------------------------------
-- 8. ALTER CONSTRAINTS on score tables
-- ----------------------------------------------------------------

-- Score cache: PK(player_id) → PK(player_id, group_id)
alter table public.score_cache drop constraint if exists score_cache_pkey;
alter table public.score_cache alter column group_id set not null;
alter table public.score_cache add primary key (player_id, group_id);

-- Score cache trio detail: PK(player_id, castaway_id) → PK(player_id, castaway_id, group_id)
alter table public.score_cache_trio_detail drop constraint if exists score_cache_trio_detail_pkey;
alter table public.score_cache_trio_detail alter column group_id set not null;
alter table public.score_cache_trio_detail add primary key (player_id, castaway_id, group_id);

-- ----------------------------------------------------------------
-- 9. INDEXES for performance
-- ----------------------------------------------------------------

create index idx_score_cache_group_id on public.score_cache(group_id);
create index idx_group_members_user_id on public.group_members(user_id);
create index idx_groups_invite_code on public.groups(invite_code);

-- ----------------------------------------------------------------
-- 10. PICKS & PROPHECY ANSWERS RLS — no changes needed
-- The existing policies on picks and prophecy_answers remain
-- unchanged since these tables have no group_id. The old app
-- and new app both use the same player_id-based constraints.
-- ----------------------------------------------------------------

-- ----------------------------------------------------------------
-- 11. BACKWARD-COMPAT: Restrict score_cache reads to active group
-- The old app queries score_cache without group_id and uses
-- .maybeSingle(), which breaks with multiple rows. Replace the
-- blanket "using (true)" policy with one that only returns rows
-- matching the caller's active_group_id. The new app always sets
-- active_group_id before querying and also filters by group_id
-- explicitly, so both code paths work.
--
-- TODO: Remove this once all users are on the new app version
-- and restore "using (true)" if desired.
-- ----------------------------------------------------------------

-- Drop the old blanket read policies
drop policy if exists "Anyone authenticated can read score cache" on public.score_cache;
drop policy if exists "Anyone authenticated can read score cache trio detail" on public.score_cache_trio_detail;

-- New policies: only return rows for the caller's active group
create policy "Read score cache for active group"
  on public.score_cache for select
  to authenticated
  using (
    group_id = (select active_group_id from public.profiles where id = auth.uid())
  );

create policy "Read score cache trio detail for active group"
  on public.score_cache_trio_detail for select
  to authenticated
  using (
    group_id = (select active_group_id from public.profiles where id = auth.uid())
  );
