-- ============================================================
-- 003_seed_castaways.sql
-- Seed all 24 Survivor Season 50 castaways
-- ============================================================

insert into public.castaways (name, tribe) values
  -- VATU tribe
  ('Colby',      'VATU'),
  ('Genevieve',  'VATU'),
  ('Rizzo',      'VATU'),
  ('Angelina',   'VATU'),
  ('Q',          'VATU'),
  ('Stephenie',  'VATU'),
  ('Kyle',       'VATU'),
  ('Aubry',      'VATU'),

  -- CILA tribe
  ('Joe',        'CILA'),
  ('Savannah',   'CILA'),
  ('Christian',  'CILA'),
  ('Cirie',      'CILA'),
  ('Ozzy',       'CILA'),
  ('Emily',      'CILA'),
  ('Rick',       'CILA'),
  ('Jenna',      'CILA'),

  -- KALO tribe
  ('Jonathan',   'KALO'),
  ('Dee',        'KALO'),
  ('Mike',       'KALO'),
  ('Kamilla',    'KALO'),
  ('Charlie',    'KALO'),
  ('Tiffany',    'KALO'),
  ('Coach',      'KALO'),
  ('Chrissy',    'KALO');
