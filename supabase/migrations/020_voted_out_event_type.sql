-- Add 'voted_out' as a valid event_type for castaway_events.
-- This is a base marker written for all eliminated castaways so they
-- appear correctly in the episode recap and admin editor reload.

ALTER TABLE castaway_events
DROP CONSTRAINT castaway_events_event_type_check;

ALTER TABLE castaway_events
ADD CONSTRAINT castaway_events_event_type_check
CHECK (event_type IN (
  'idol_found', 'advantage_found', 'idol_played_correct', 'idol_played_incorrect',
  'shot_in_dark_success', 'shot_in_dark_fail', 'fire_making_win',
  'individual_immunity_win', 'individual_reward_win', 'final_immunity_win',
  'made_jury', 'placed_3rd', 'placed_runner_up', 'sole_survivor',
  'first_boot', 'voted_out_with_idol', 'voted_out_with_advantage',
  'voted_out_unanimously', 'quit', 'survived_episode', 'voted_out'
));
