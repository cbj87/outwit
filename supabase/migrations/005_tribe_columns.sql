-- ============================================================
-- 005_tribe_columns.sql
-- Replace single `tribe` column with `original_tribe` + `current_tribe`
-- to support tribe swaps, splits, and merges during the season.
-- ============================================================

-- 1. Add new columns (nullable initially for backfill)
alter table public.castaways add column original_tribe text;
alter table public.castaways add column current_tribe text;

-- 2. Backfill from existing tribe column
update public.castaways set original_tribe = tribe, current_tribe = tribe;

-- 3. Make NOT NULL
alter table public.castaways alter column original_tribe set not null;
alter table public.castaways alter column current_tribe set not null;

-- 4. Drop old column (also drops its CHECK constraint)
alter table public.castaways drop column tribe;
