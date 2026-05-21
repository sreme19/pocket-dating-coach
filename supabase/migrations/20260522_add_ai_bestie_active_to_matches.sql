-- Add ai_bestie_active flag to verified_vibe_matches
-- This tracks whether the female user in a match has activated AI Bestie interview mode.
-- When true, the male match sees an intro card explaining the setup.

ALTER TABLE verified_vibe_matches
  ADD COLUMN IF NOT EXISTS ai_bestie_active BOOLEAN NOT NULL DEFAULT FALSE;
