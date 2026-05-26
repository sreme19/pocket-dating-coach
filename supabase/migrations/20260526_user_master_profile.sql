-- ============================================================================
-- user_master_profile
-- A single JSON document per user that is the authoritative source of truth
-- for everything we know about them: identity, onboarding QA, generated
-- profile copy, verified proofs, countries traveled, and any other data
-- previously siloed in localStorage.
--
-- JSON blob structure (all fields optional / additive):
-- {
--   "identity":         { firstName, age, city, archetype, gender },
--   "profileDraft":     { ...ProfileIntakeData },
--   "generatedProfile": { about, personalityDescriptors[], intentStatement, lifestyleTags[] },
--   "onboarding":       { vv_qa_responses, vv_casual_generous_profile, ... },
--   "verifiedProofs":   [ { category, insights[], aggregated, locations[], verified_at } ],
--   "countriesTraveled": string[],
--   "lastSynced":       ISO timestamp
-- }
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_master_profile (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  data       JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_master_profile_user_id_unique UNIQUE (user_id)
);

-- Index for quick lookup by user
CREATE INDEX IF NOT EXISTS idx_user_master_profile_user_id
  ON user_master_profile (user_id);

-- GIN index so Supabase/Postgres can efficiently query inside the JSONB blob
CREATE INDEX IF NOT EXISTS idx_user_master_profile_data
  ON user_master_profile USING GIN (data);

-- ── Row-Level Security ────────────────────────────────────────────────────────

ALTER TABLE user_master_profile ENABLE ROW LEVEL SECURITY;

-- Users can read and write ONLY their own row
CREATE POLICY "user_master_profile_self_select"
  ON user_master_profile FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_master_profile_self_insert"
  ON user_master_profile FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_master_profile_self_update"
  ON user_master_profile FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role (backend) has unrestricted access — needed for AI Wingman,
-- auto-fill, and any server-side read without a user JWT
CREATE POLICY "user_master_profile_service_all"
  ON user_master_profile FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_user_master_profile_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_master_profile_updated_at
  BEFORE UPDATE ON user_master_profile
  FOR EACH ROW EXECUTE FUNCTION update_user_master_profile_updated_at();
