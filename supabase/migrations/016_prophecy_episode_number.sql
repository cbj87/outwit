-- ============================================================
-- 016_prophecy_episode_number.sql
-- Add episode_number to prophecy_outcomes so we can show which
-- episode a prophecy was resolved in (for episode recaps and
-- per-episode score breakdowns).
-- Nullable for backwards compatibility with existing data.
-- ============================================================

ALTER TABLE public.prophecy_outcomes
  ADD COLUMN IF NOT EXISTS episode_number int;
