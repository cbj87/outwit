-- ============================================================
-- 008_tribe_colors.sql
-- Stores commissioner-editable tribe colors
-- ============================================================

create table public.tribe_colors (
  tribe_name  text primary key,
  color       text not null
);

-- Seed with default tribe colors
insert into public.tribe_colors (tribe_name, color) values
  ('VATU', '#2E7D32'),
  ('CILA', '#1565C0'),
  ('KALO', '#F57F17'),
  ('MERGED', '#8E8E93');

-- RLS
alter table public.tribe_colors enable row level security;

create policy "Anyone authenticated can read tribe colors"
  on public.tribe_colors for select
  to authenticated
  using (true);

create policy "Commissioner can manage tribe colors"
  on public.tribe_colors for all
  to authenticated
  using (public.is_commissioner())
  with check (public.is_commissioner());
