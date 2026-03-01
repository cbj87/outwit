-- ============================================================
-- 015_fix_spoiler_protection.sql
-- Tighten score_snapshots RLS to group members only and add
-- REPLICA IDENTITY FULL for Realtime compatibility.
-- ============================================================

-- 1. Replace the overly permissive read policy with one scoped
--    to the caller's active group (matches score_cache pattern
--    from 009_multi_group.sql).
drop policy if exists "Anyone authenticated can read score snapshots"
  on public.score_snapshots;

create policy "Read score snapshots for active group"
  on public.score_snapshots for select
  to authenticated
  using (
    group_id = (select active_group_id from public.profiles where id = auth.uid())
  );

-- 2. Enable REPLICA IDENTITY FULL so Realtime subscriptions can
--    deliver changes on this table if needed in the future.
alter table public.score_snapshots replica identity full;
