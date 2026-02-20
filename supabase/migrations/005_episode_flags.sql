-- Add merge and finale flags to episodes table
ALTER TABLE episodes ADD COLUMN is_merge boolean NOT NULL DEFAULT false;
ALTER TABLE episodes ADD COLUMN is_finale boolean NOT NULL DEFAULT false;
