-- Bio questions table (server-driven, editable from Supabase dashboard)
CREATE TABLE public.bio_questions (
  id serial PRIMARY KEY,
  key text UNIQUE NOT NULL,
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.bio_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read bio questions"
  ON public.bio_questions FOR SELECT USING (true);

-- Seed with current questions
INSERT INTO public.bio_questions (key, label, sort_order) VALUES
  ('bio', 'Survivor Bio', 1),
  ('favorite_player', 'Favorite Survivor player?', 2),
  ('model_game', 'Who would you model your game after?', 3),
  ('wouldnt_go', 'If ________ was on my season, I wouldn''t go.', 4),
  ('luxury_item', 'What''s your luxury item?', 5),
  ('day1_strategy', 'What would your Day 1 strategy be?', 6),
  ('dominate_challenge', 'What challenge would you dominate?', 7),
  ('worst_challenge', 'What challenge would send you home?', 8);
