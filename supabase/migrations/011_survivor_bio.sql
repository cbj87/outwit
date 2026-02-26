-- Add survivor bio Q&A as a JSONB column on profiles
ALTER TABLE public.profiles ADD COLUMN survivor_bio jsonb DEFAULT '{}'::jsonb;
