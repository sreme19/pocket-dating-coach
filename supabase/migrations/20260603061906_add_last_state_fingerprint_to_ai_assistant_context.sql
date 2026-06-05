ALTER TABLE ai_assistant_context
ADD COLUMN IF NOT EXISTS last_state_fingerprint TEXT;

COMMENT ON COLUMN ai_assistant_context.last_state_fingerprint IS
'Fingerprint of the user''s material state (mode | proof count.categories | mutual matches | trust score) captured at the last greeting actually sent. If unchanged on the next session, the greeting is skipped (no Claude call) to avoid repetition and save tokens.';;
