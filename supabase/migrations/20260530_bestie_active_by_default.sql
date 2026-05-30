-- AI Bestie should be on by default for all matches.
-- Change column default and backfill existing rows.
ALTER TABLE verified_vibe_matches
  ALTER COLUMN ai_bestie_active SET DEFAULT TRUE;

UPDATE verified_vibe_matches
SET ai_bestie_active = TRUE
WHERE ai_bestie_active = FALSE;
