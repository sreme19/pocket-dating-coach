ALTER TABLE verified_vibe_users
  ADD COLUMN IF NOT EXISTS is_provisional BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_vv_users_provisional
  ON verified_vibe_users (is_provisional)
  WHERE is_provisional = true;

COMMENT ON COLUMN verified_vibe_users.is_provisional IS
  '/aibestie ad-landing visitors who have not signed up. Excluded from every real-member query via realMembersOnly(). Cleared on signup; purged after 30 days.';;
