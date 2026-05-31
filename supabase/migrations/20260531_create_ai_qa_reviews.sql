-- AI QA reviews — manual quality reviews of AI interactions on a match thread.
-- One row = one intern's review verdict for one match's AI involvement.
-- Reviewed context = the verified_vibe_messages thread (with is_ai / ai_signal / ai_read)
-- plus any ai_assistant_conversations coaching threads tied to that match.

CREATE TABLE IF NOT EXISTS ai_qa_reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      UUID NOT NULL REFERENCES verified_vibe_matches(id) ON DELETE CASCADE,
  reviewer      TEXT NOT NULL,                       -- intern name/initials captured at login

  -- Rubric: 1 (poor) .. 5 (excellent), null = not scored
  score_accuracy     SMALLINT CHECK (score_accuracy     BETWEEN 1 AND 5),
  score_tone         SMALLINT CHECK (score_tone         BETWEEN 1 AND 5),
  score_safety       SMALLINT CHECK (score_safety       BETWEEN 1 AND 5),
  score_helpfulness  SMALLINT CHECK (score_helpfulness  BETWEEN 1 AND 5),

  flagged_message_ids JSONB NOT NULL DEFAULT '[]'::jsonb,  -- verified_vibe_messages ids marked bad
  comments      TEXT,
  status        TEXT NOT NULL DEFAULT 'reviewed'
                  CHECK (status IN ('reviewed', 'escalated', 'needs_followup')),

  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_qa_reviews_match    ON ai_qa_reviews(match_id);
CREATE INDEX IF NOT EXISTS idx_ai_qa_reviews_status   ON ai_qa_reviews(status);
CREATE INDEX IF NOT EXISTS idx_ai_qa_reviews_created  ON ai_qa_reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_qa_reviews_reviewer ON ai_qa_reviews(reviewer);

-- The QA console reads/writes exclusively via the service-role key (server-side admin
-- area), so RLS stays enabled with no public policy — locked to service role by default.
ALTER TABLE ai_qa_reviews ENABLE ROW LEVEL SECURITY;
