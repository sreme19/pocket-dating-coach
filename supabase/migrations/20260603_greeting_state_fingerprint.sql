-- ============================================================================
-- Greeting state fingerprint — skip regenerating the proactive greeting when
-- the user's material state (stage, proof count/categories, mutual matches,
-- trust score) has not changed since the last greeting we actually sent.
-- Stops the "upload a proof" nudge repeating every visit and saves Claude tokens.
-- Created: 2026-06-03
-- ============================================================================

ALTER TABLE ai_assistant_context
  ADD COLUMN IF NOT EXISTS last_state_fingerprint TEXT;

COMMENT ON COLUMN ai_assistant_context.last_state_fingerprint IS
  'Fingerprint of the user''s material state (mode | proof count.categories | mutual matches | trust score) captured at the last greeting actually sent. If unchanged on the next session, the greeting is skipped (no Claude call) to avoid repetition and save tokens.';
