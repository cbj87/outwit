-- ============================================================
-- 014_spoiler_protection.sql
-- Add opt-in spoiler protection flag to profiles.
-- When enabled, the leaderboard gates scores behind episode
-- seen status. Default false for full backward compatibility.
-- ============================================================

alter table public.profiles
  add column if not exists spoiler_protection boolean not null default false;
