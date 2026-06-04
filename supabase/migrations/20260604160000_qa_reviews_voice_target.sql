-- ============================================================================
-- QA reviews can target a voice call (branch voiceAI)
-- Lets reviewers score AI Bestie voice calls in /admin/qa, alongside match
-- threads and advisor chats. Adds a third review target + relaxes the
-- exactly-one-target constraint from two options to three.
-- ============================================================================

ALTER TABLE ai_qa_reviews
  ADD COLUMN IF NOT EXISTS voice_call_id UUID
  REFERENCES vv_voice_calls(id) ON DELETE CASCADE;

-- Exactly one review target: match thread XOR advisor chat XOR voice call.
ALTER TABLE ai_qa_reviews
  DROP CONSTRAINT IF EXISTS chk_ai_qa_reviews_target;

ALTER TABLE ai_qa_reviews
  ADD CONSTRAINT chk_ai_qa_reviews_target CHECK (
    (
      (CASE WHEN match_id IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN advisor_chat_id IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN voice_call_id IS NOT NULL THEN 1 ELSE 0 END)
    ) = 1
  );

CREATE INDEX IF NOT EXISTS idx_ai_qa_reviews_voice
  ON ai_qa_reviews(voice_call_id);
