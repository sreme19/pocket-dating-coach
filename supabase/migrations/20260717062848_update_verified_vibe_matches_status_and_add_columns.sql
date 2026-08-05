ALTER TABLE verified_vibe_matches
DROP CONSTRAINT IF EXISTS verified_vibe_matches_status_check;

ALTER TABLE verified_vibe_matches
ADD CONSTRAINT verified_vibe_matches_status_check
CHECK (status IN ('pending', 'mutual', 'rejected', 'unmatched', 'blocked', 'expired'));

ALTER TABLE verified_vibe_matches
ADD COLUMN IF NOT EXISTS expired_at timestamptz;

ALTER TABLE verified_vibe_matches
ADD COLUMN IF NOT EXISTS replaced_by_match_id uuid;

ALTER TABLE verified_vibe_matches
ADD COLUMN IF NOT EXISTS handoff_nudge_stage smallint NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS verified_vibe_matches_expired_at_idx
ON verified_vibe_matches(expired_at);;
