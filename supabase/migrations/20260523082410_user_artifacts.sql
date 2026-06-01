CREATE TABLE IF NOT EXISTS user_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  storage_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  claim_tag TEXT NOT NULL,
  description TEXT,
  trust_points INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_artifacts_user_id ON user_artifacts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_artifacts_claim_tag ON user_artifacts(claim_tag);

ALTER TABLE user_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_artifacts" ON user_artifacts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "service_role_all_artifacts" ON user_artifacts
  FOR ALL TO service_role USING (true);;
