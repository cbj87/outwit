-- ============================================================
-- 010_fix_picks_rls_for_groups.sql
-- Fix picks & prophecy_answers RLS policies to check
-- groups.picks_revealed instead of season_config.picks_revealed.
-- Also update deadline checks to use the group's deadline.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. PICKS: Fix "read all after reveal" policy
-- ----------------------------------------------------------------

drop policy if exists "Players can read all picks after reveal" on public.picks;

create policy "Players can read all picks after reveal"
  on public.picks for select
  to authenticated
  using (
    exists (
      select 1 from public.groups g
      join public.profiles p on p.active_group_id = g.id
      where p.id = auth.uid()
        and g.picks_revealed = true
    )
  );

-- ----------------------------------------------------------------
-- 2. PICKS: Fix insert policy to use group deadline
-- ----------------------------------------------------------------

drop policy if exists "Players can submit own picks" on public.picks;

create policy "Players can submit own picks"
  on public.picks for insert
  to authenticated
  with check (
    player_id = auth.uid()
    and not is_locked
    and now() < (
      select g.picks_deadline from public.groups g
      join public.profiles p on p.active_group_id = g.id
      where p.id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- 3. PICKS: Fix update policy to use group deadline
-- ----------------------------------------------------------------

drop policy if exists "Players can update own unlocked picks before deadline" on public.picks;

create policy "Players can update own unlocked picks before deadline"
  on public.picks for update
  to authenticated
  using (
    player_id = auth.uid()
    and not is_locked
    and now() < (
      select g.picks_deadline from public.groups g
      join public.profiles p on p.active_group_id = g.id
      where p.id = auth.uid()
    )
  )
  with check (
    player_id = auth.uid()
    and not is_locked
  );

-- ----------------------------------------------------------------
-- 4. PROPHECY ANSWERS: Fix "read all after reveal" policy
-- ----------------------------------------------------------------

drop policy if exists "Players can read all prophecy answers after reveal" on public.prophecy_answers;

create policy "Players can read all prophecy answers after reveal"
  on public.prophecy_answers for select
  to authenticated
  using (
    exists (
      select 1 from public.groups g
      join public.profiles p on p.active_group_id = g.id
      where p.id = auth.uid()
        and g.picks_revealed = true
    )
  );

-- ----------------------------------------------------------------
-- 5. PROPHECY ANSWERS: Fix insert policy to use group deadline
-- ----------------------------------------------------------------

drop policy if exists "Players can submit own prophecy answers" on public.prophecy_answers;

create policy "Players can submit own prophecy answers"
  on public.prophecy_answers for insert
  to authenticated
  with check (
    player_id = auth.uid()
    and now() < (
      select g.picks_deadline from public.groups g
      join public.profiles p on p.active_group_id = g.id
      where p.id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- 6. PROPHECY ANSWERS: Fix update policy to use group deadline
-- ----------------------------------------------------------------

drop policy if exists "Players can update own prophecy answers before deadline" on public.prophecy_answers;

create policy "Players can update own prophecy answers before deadline"
  on public.prophecy_answers for update
  to authenticated
  using (
    player_id = auth.uid()
    and now() < (
      select g.picks_deadline from public.groups g
      join public.profiles p on p.active_group_id = g.id
      where p.id = auth.uid()
    )
    and not exists (
      select 1 from public.picks
      where picks.player_id = auth.uid() and picks.is_locked = true
    )
  )
  with check (player_id = auth.uid());
