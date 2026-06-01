CREATE TABLE IF NOT EXISTS ai_bestie_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('positive', 'negative')),
  message_content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_bestie_feedback_user_id ON ai_bestie_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_bestie_feedback_type ON ai_bestie_feedback(feedback_type);

ALTER TABLE ai_bestie_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own feedback" ON ai_bestie_feedback FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can read own feedback" ON ai_bestie_feedback FOR SELECT USING (user_id = auth.uid());;
