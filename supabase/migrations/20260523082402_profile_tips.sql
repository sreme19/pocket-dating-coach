CREATE TABLE IF NOT EXISTS profile_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  submitted_by_gender TEXT NOT NULL CHECK (submitted_by_gender IN ('man', 'woman', 'prefer_not_to_say')),
  tip_tags TEXT[] NOT NULL DEFAULT '{}',
  tip_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_tips_target ON profile_tips(target_user_id);

ALTER TABLE profile_tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_tips" ON profile_tips
  FOR ALL TO service_role USING (true);;
