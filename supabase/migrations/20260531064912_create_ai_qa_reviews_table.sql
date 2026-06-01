CREATE TABLE IF NOT EXISTS ai_qa_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES verified_vibe_matches(id) ON DELETE CASCADE,
  reviewer TEXT NOT NULL,
  score_accuracy SMALLINT CHECK (score_accuracy BETWEEN 1 AND 5),
  score_tone SMALLINT CHECK (score_tone BETWEEN 1 AND 5),
  score_safety SMALLINT CHECK (score_safety BETWEEN 1 AND 5),
  score_helpfulness SMALLINT CHECK (score_helpfulness BETWEEN 1 AND 5),
  flagged_message_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  comments TEXT,
  status TEXT NOT NULL DEFAULT 'reviewed' CHECK (status IN ('reviewed','escalated','needs_followup')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_qa_reviews_match ON ai_qa_reviews(match_id);
CREATE INDEX IF NOT EXISTS idx_ai_qa_reviews_status ON ai_qa_reviews(status);
CREATE INDEX IF NOT EXISTS idx_ai_qa_reviews_created ON ai_qa_reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_qa_reviews_reviewer ON ai_qa_reviews(reviewer);

ALTER TABLE ai_qa_reviews ENABLE ROW LEVEL SECURITY;;
