ALTER TABLE ai_qa_reviews
ADD COLUMN IF NOT EXISTS voice_call_id UUID
REFERENCES vv_voice_calls(id) ON DELETE CASCADE;

ALTER TABLE ai_qa_reviews
DROP CONSTRAINT IF EXISTS chk_ai_qa_reviews_target;

ALTER TABLE ai_qa_reviews
ADD CONSTRAINT chk_ai_qa_reviews_target CHECK (
  ((CASE WHEN match_id IS NOT NULL THEN 1 ELSE 0 END) +
   (CASE WHEN advisor_chat_id IS NOT NULL THEN 1 ELSE 0 END) +
   (CASE WHEN voice_call_id IS NOT NULL THEN 1 ELSE 0 END)) = 1
);

CREATE INDEX IF NOT EXISTS idx_ai_qa_reviews_voice
ON ai_qa_reviews(voice_call_id);;
