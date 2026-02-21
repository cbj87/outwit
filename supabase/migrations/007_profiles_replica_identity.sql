-- Enable Realtime on profiles table so display_name / avatar changes
-- are picked up by the leaderboard subscription.
alter table public.profiles replica identity full;
