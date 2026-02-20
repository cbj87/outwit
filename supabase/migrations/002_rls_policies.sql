-- ============================================================
-- 002_rls_policies.sql
-- Row Level Security policies for all tables
-- ============================================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.season_config enable row level security;
alter table public.castaways enable row level security;
alter table public.picks enable row level security;
alter table public.prophecy_answers enable row level security;
alter table public.episodes enable row level security;
alter table public.castaway_events enable row level security;
alter table public.prophecy_outcomes enable row level security;
alter table public.score_cache enable row level security;
alter table public.score_cache_trio_detail enable row level security;

-- ----------------------------------------------------------------
-- Helper: check if caller is commissioner
-- ----------------------------------------------------------------
create or replace function public.is_commissioner()
returns boolean
language sql
security definer
stable
as $$
  select coalesce(
    (select is_commissioner from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ----------------------------------------------------------------
-- PROFILES
-- ----------------------------------------------------------------
create policy "Anyone authenticated can read profiles"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- INSERT is handled by the trigger (service role), no user policy needed

-- ----------------------------------------------------------------
-- SEASON CONFIG
-- ----------------------------------------------------------------
create policy "Anyone authenticated can read season config"
  on public.season_config for select
  to authenticated
  using (true);

create policy "Commissioner can update season config"
  on public.season_config for update
  to authenticated
  using (public.is_commissioner())
  with check (public.is_commissioner());

-- ----------------------------------------------------------------
-- CASTAWAYS
-- ----------------------------------------------------------------
create policy "Anyone authenticated can read castaways"
  on public.castaways for select
  to authenticated
  using (true);

create policy "Commissioner can manage castaways"
  on public.castaways for all
  to authenticated
  using (public.is_commissioner())
  with check (public.is_commissioner());

-- ----------------------------------------------------------------
-- PICKS
-- Players always see their own pick.
-- Other players' picks visible only after picks_revealed = true.
-- ----------------------------------------------------------------
create policy "Players can read own picks"
  on public.picks for select
  to authenticated
  using (player_id = auth.uid());

create policy "Players can read all picks after reveal"
  on public.picks for select
  to authenticated
  using (
    (select picks_revealed from public.season_config limit 1) = true
  );

create policy "Players can submit own picks"
  on public.picks for insert
  to authenticated
  with check (
    player_id = auth.uid()
    and not is_locked
    and now() < (select picks_deadline from public.season_config limit 1)
  );

create policy "Players can update own unlocked picks before deadline"
  on public.picks for update
  to authenticated
  using (
    player_id = auth.uid()
    and not is_locked
    and now() < (select picks_deadline from public.season_config limit 1)
  )
  with check (
    player_id = auth.uid()
    and not is_locked
  );

-- ----------------------------------------------------------------
-- PROPHECY ANSWERS
-- Same visibility rules as picks.
-- ----------------------------------------------------------------
create policy "Players can read own prophecy answers"
  on public.prophecy_answers for select
  to authenticated
  using (player_id = auth.uid());

create policy "Players can read all prophecy answers after reveal"
  on public.prophecy_answers for select
  to authenticated
  using (
    (select picks_revealed from public.season_config limit 1) = true
  );

create policy "Players can submit own prophecy answers"
  on public.prophecy_answers for insert
  to authenticated
  with check (
    player_id = auth.uid()
    and now() < (select picks_deadline from public.season_config limit 1)
  );

create policy "Players can update own prophecy answers before deadline"
  on public.prophecy_answers for update
  to authenticated
  using (
    player_id = auth.uid()
    and now() < (select picks_deadline from public.season_config limit 1)
    and not exists (
      select 1 from public.picks
      where picks.player_id = auth.uid() and picks.is_locked = true
    )
  )
  with check (player_id = auth.uid());

-- ----------------------------------------------------------------
-- EPISODES
-- ----------------------------------------------------------------
create policy "Anyone authenticated can read episodes"
  on public.episodes for select
  to authenticated
  using (true);

create policy "Commissioner can manage episodes"
  on public.episodes for all
  to authenticated
  using (public.is_commissioner())
  with check (public.is_commissioner());

-- ----------------------------------------------------------------
-- CASTAWAY EVENTS
-- ----------------------------------------------------------------
create policy "Anyone authenticated can read castaway events"
  on public.castaway_events for select
  to authenticated
  using (true);

create policy "Commissioner can manage castaway events"
  on public.castaway_events for all
  to authenticated
  using (public.is_commissioner())
  with check (public.is_commissioner());

-- ----------------------------------------------------------------
-- PROPHECY OUTCOMES
-- ----------------------------------------------------------------
create policy "Anyone authenticated can read prophecy outcomes"
  on public.prophecy_outcomes for select
  to authenticated
  using (true);

create policy "Commissioner can manage prophecy outcomes"
  on public.prophecy_outcomes for all
  to authenticated
  using (public.is_commissioner())
  with check (public.is_commissioner());

-- ----------------------------------------------------------------
-- SCORE CACHE
-- Read by all; written by service role (Edge Function) only.
-- ----------------------------------------------------------------
create policy "Anyone authenticated can read score cache"
  on public.score_cache for select
  to authenticated
  using (true);

-- No user-facing insert/update/delete — handled by Edge Function via service role

-- ----------------------------------------------------------------
-- SCORE CACHE TRIO DETAIL
-- ----------------------------------------------------------------
create policy "Anyone authenticated can read score cache trio detail"
  on public.score_cache_trio_detail for select
  to authenticated
  using (true);
