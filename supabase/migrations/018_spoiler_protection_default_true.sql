-- ============================================================
-- 018_spoiler_protection_default_true.sql
-- Change spoiler protection default from false to true so new
-- users are opted in by default. Existing users keep their
-- current setting (false or true) unchanged.
-- ============================================================

alter table public.profiles
  alter column spoiler_protection set default true;
