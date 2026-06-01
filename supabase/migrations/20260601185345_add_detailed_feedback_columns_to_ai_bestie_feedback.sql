-- Add detailed-feedback columns to ai_bestie_feedback so a thumbs-down on any
-- AI reply (Bestie OR Wingman) can capture a reason chip + free-text note,
-- mirroring the proactive-greeting feedback flow.
--
-- The table is reused for both assistants; assistant_type distinguishes them.
-- Existing readers (admin analytics, user-activity, QA console) select named
-- columns or `*`, so adding nullable columns is backward-compatible.
ALTER TABLE ai_bestie_feedback
  ADD COLUMN IF NOT EXISTS assistant_type TEXT NOT NULL DEFAULT 'bestie',
  ADD COLUMN IF NOT EXISTS reason_chip    TEXT,
  ADD COLUMN IF NOT EXISTS feedback_text  TEXT;

-- Constrain assistant_type to known values (drop-then-add for idempotency).
ALTER TABLE ai_bestie_feedback DROP CONSTRAINT IF EXISTS ai_bestie_feedback_assistant_type_check;
ALTER TABLE ai_bestie_feedback
  ADD CONSTRAINT ai_bestie_feedback_assistant_type_check
  CHECK (assistant_type IN ('bestie', 'wingman'));

CREATE INDEX IF NOT EXISTS idx_ai_bestie_feedback_assistant_type
  ON ai_bestie_feedback(assistant_type);;
