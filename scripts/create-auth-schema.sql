-- ============================================================================
-- Verified Vibe Auth Schema
-- Run this in your Supabase SQL editor
-- ============================================================================

-- Profiles table (linked to auth.users, one row per authenticated user)
CREATE TABLE IF NOT EXISTS verified_vibe_profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  gender     TEXT CHECK (gender IN ('man', 'woman', 'prefer_not_to_say')),
  archetype  TEXT CHECK (archetype IN ('casual_man', 'marriage_minded_man', 'spoilt_woman', 'safety_first_woman')),
  first_name TEXT,
  age        INT,
  city       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Verification steps table (one row per user per step, upsert-safe)
CREATE TABLE IF NOT EXISTS verified_vibe_verification_steps (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step         TEXT        NOT NULL CHECK (step IN ('id', 'liveness', 'photos', 'spending_or_qa')),
  trust_points INT         NOT NULL DEFAULT 0,
  data         JSONB,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, step)
);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE verified_vibe_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE verified_vibe_verification_steps ENABLE ROW LEVEL SECURITY;

-- Profiles: each user can only read/write their own row
CREATE POLICY "vv_profiles_select" ON verified_vibe_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "vv_profiles_insert" ON verified_vibe_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "vv_profiles_update" ON verified_vibe_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Verification steps: each user can only read/write their own rows
CREATE POLICY "vv_steps_select" ON verified_vibe_verification_steps
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "vv_steps_insert" ON verified_vibe_verification_steps
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "vv_steps_update" ON verified_vibe_verification_steps
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- Auto-update updated_at on profiles
-- ============================================================================

CREATE OR REPLACE FUNCTION update_vv_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vv_profiles_updated_at ON verified_vibe_profiles;
CREATE TRIGGER trg_vv_profiles_updated_at
  BEFORE UPDATE ON verified_vibe_profiles
  FOR EACH ROW EXECUTE FUNCTION update_vv_updated_at();

-- ============================================================================
-- NOTE: Set OTP expiry to 5 minutes
-- Go to: Supabase Dashboard → Authentication → Settings
-- Set "OTP Expiry" to 300 seconds
-- ============================================================================
