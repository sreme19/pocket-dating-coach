-- Hand-off timeout, reactivation & nudge tracking (2026-07-17). Spec B2 (revised).
--
-- When AI Bestie hands a match off to the woman, she has 48h to step in. If she
-- never does, the match becomes 'expired' — a REVERSIBLE terminal state (distinct
-- from the destructive 'unmatched'):
--   * His side  → moves to an Inactive section (no reactivate control) and he is
--                 given a fresh replacement match.
--   * Her side  → moves to an Inactive section WITH a Reactivate button.
-- She (and only she) can reactivate; that flips the row back to 'mutual' and
-- restores it on both sides, thread history intact. Unreactivated 'expired' rows
-- are purged after 30 days.
--
-- 'expired' MUST be preserved (not deleted) so reactivation can restore the thread,
-- so we extend the status CHECK constraint rather than reusing 'unmatched'.
ALTER TABLE verified_vibe_matches
  DROP CONSTRAINT IF EXISTS verified_vibe_matches_status_check;

ALTER TABLE verified_vibe_matches
  ADD CONSTRAINT verified_vibe_matches_status_check
  CHECK (status IN ('pending', 'mutual', 'rejected', 'unmatched', 'blocked', 'expired'));

-- When the hand-off window elapsed and the row became 'expired'. Drives the
-- Inactive display and the 30-day purge. NULL for every non-expired row.
ALTER TABLE verified_vibe_matches
  ADD COLUMN IF NOT EXISTS expired_at timestamptz;

-- The replacement match created for the man when this one expired. Traceability
-- only (analytics + "he holds both"); no FK so a later purge can't cascade.
ALTER TABLE verified_vibe_matches
  ADD COLUMN IF NOT EXISTS replaced_by_match_id uuid;

-- How far the woman-facing hand-off nudge cadence has advanced for this match:
--   0 = none sent, 1 = hand-off nudge, 2 = 24h reminder, 3 = final-hours warning.
-- The timeout cron advances this so each stage fires at most once per hand-off; it
-- resets to 0 on reactivation so a re-vet/re-handoff nudges again.
ALTER TABLE verified_vibe_matches
  ADD COLUMN IF NOT EXISTS handoff_nudge_stage smallint NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS verified_vibe_matches_expired_at_idx
  ON verified_vibe_matches(expired_at);
