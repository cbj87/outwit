-- ============================================================
-- 003_seed_castaways.sql
-- Seed all 24 Survivor Season 50 castaways
-- ============================================================

insert into public.castaways (name, original_tribe, current_tribe) values
  -- VATU tribe
  ('Colby',      'VATU', 'VATU'),
  ('Genevieve',  'VATU', 'VATU'),
  ('Rizzo',      'VATU', 'VATU'),
  ('Angelina',   'VATU', 'VATU'),
  ('Q',          'VATU', 'VATU'),
  ('Stephenie',  'VATU', 'VATU'),
  ('Kyle',       'VATU', 'VATU'),
  ('Aubry',      'VATU', 'VATU'),

  -- CILA tribe
  ('Joe',        'CILA', 'CILA'),
  ('Savannah',   'CILA', 'CILA'),
  ('Christian',  'CILA', 'CILA'),
  ('Cirie',      'CILA', 'CILA'),
  ('Ozzy',       'CILA', 'CILA'),
  ('Emily',      'CILA', 'CILA'),
  ('Rick',       'CILA', 'CILA'),
  ('Jenna',      'CILA', 'CILA'),

  -- KALO tribe
  ('Jonathan',   'KALO', 'KALO'),
  ('Dee',        'KALO', 'KALO'),
  ('Mike',       'KALO', 'KALO'),
  ('Kamilla',    'KALO', 'KALO'),
  ('Charlie',    'KALO', 'KALO'),
  ('Tiffany',    'KALO', 'KALO'),
  ('Coach',      'KALO', 'KALO'),
  ('Chrissy',    'KALO', 'KALO');
