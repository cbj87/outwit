-- ============================================================
-- 017_episode_seen_update_policy.sql
-- Add UPDATE RLS policy on episode_seen_status so upserts
-- can update the seen_at timestamp for existing rows.
-- ============================================================

create policy "Players can update own seen status"
  on public.episode_seen_status for update
  to authenticated
  using (player_id = auth.uid())
  with check (player_id = auth.uid());
