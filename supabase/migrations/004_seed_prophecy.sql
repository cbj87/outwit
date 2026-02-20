-- ============================================================
-- 004_seed_prophecy.sql
-- Seed 16 prophecy outcome rows (all initially unresolved)
-- ============================================================

insert into public.prophecy_outcomes (question_id, outcome) values
  (1,  null),  -- Q mentions cancelling Christmas (1pt)
  (2,  null),  -- Someone says "playing chess not checkers" (1pt)
  (3,  null),  -- Eagle screech sound when Coach is on screen (1pt)
  (4,  null),  -- Jeff uses his British accent (2pt)
  (5,  null),  -- A live tribal occurs (2pt)
  (6,  null),  -- Someone is voted out with an idol in their pocket (2pt)
  (7,  null),  -- A player plays an idol for someone else (2pt)
  (8,  null),  -- Someone plays a fake idol (3pt)
  (9,  null),  -- A unanimous vote happens post-merge, pre-final tribal (3pt)
  (10, null),  -- A player gives up individual immunity (4pt)
  (11, null),  -- Someone plays Shot in the Dark successfully (4pt)
  (12, null),  -- A medical evacuation occurs (4pt)
  (13, null),  -- A rock draw happens (4pt)
  (14, null),  -- There is an actual loved one visit (4pt)
  (15, null),  -- The winner receives a unanimous jury vote (4pt)
  (16, null);  -- Final tribal ends in a 4-4 tie (4pt)
