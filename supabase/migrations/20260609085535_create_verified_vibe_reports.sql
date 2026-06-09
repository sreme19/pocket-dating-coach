CREATE TABLE IF NOT EXISTS verified_vibe_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  match_id UUID,
  reason TEXT NOT NULL CHECK (reason IN ('inappropriate_content', 'harassment', 'fake_profile', 'scam', 'other')),
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'reviewing', 'actioned', 'dismissed')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_verified_vibe_reports_reporter ON verified_vibe_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_verified_vibe_reports_reported ON verified_vibe_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_verified_vibe_reports_status ON verified_vibe_reports(status);

ALTER TABLE verified_vibe_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can file reports" ON verified_vibe_reports;
CREATE POLICY "Users can file reports" ON verified_vibe_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Users can view own reports" ON verified_vibe_reports;
CREATE POLICY "Users can view own reports" ON verified_vibe_reports
  FOR SELECT USING (auth.uid() = reporter_id);;
