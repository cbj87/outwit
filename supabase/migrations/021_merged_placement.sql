-- Add 'merged' as a valid final_placement for castaways.
-- Represents castaways who made the merge but were voted out before the jury.

ALTER TABLE castaways DROP CONSTRAINT castaways_final_placement_check;

ALTER TABLE castaways ADD CONSTRAINT castaways_final_placement_check
CHECK (final_placement IN ('winner', 'runner_up', '3rd', 'jury', 'merged', 'pre_merge', 'first_boot'));
