CREATE TABLE IF NOT EXISTS user_master_profile (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  data       JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_master_profile_user_id_unique UNIQUE (user_id)
);

-- Fast lookup by user
CREATE INDEX IF NOT EXISTS idx_user_master_profile_user_id
ON user_master_profile (user_id);

-- GIN index for efficient JSONB field queries
CREATE INDEX IF NOT EXISTS idx_user_master_profile_data
ON user_master_profile USING GIN (data);

-- RLS
ALTER TABLE user_master_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_master_profile_self_select" ON user_master_profile;
CREATE POLICY "user_master_profile_self_select"
ON user_master_profile FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_master_profile_self_insert" ON user_master_profile;
CREATE POLICY "user_master_profile_self_insert"
ON user_master_profile FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_master_profile_self_update" ON user_master_profile;
CREATE POLICY "user_master_profile_self_update"
ON user_master_profile FOR UPDATE
USING (auth.uid() = user_id);

-- Service role bypasses RLS
DROP POLICY IF EXISTS "user_master_profile_service_all" ON user_master_profile;
CREATE POLICY "user_master_profile_service_all"
ON user_master_profile FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_user_master_profile_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_master_profile_updated_at ON user_master_profile;
CREATE TRIGGER trg_user_master_profile_updated_at
BEFORE UPDATE ON user_master_profile
FOR EACH ROW EXECUTE FUNCTION update_user_master_profile_updated_at();;
