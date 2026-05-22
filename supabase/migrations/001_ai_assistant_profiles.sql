-- Migration: Create ai_assistant_profiles table
--
-- Stores versioned AI assistant profiles for users:
--   preferences  -> female users (PreferencesProfile)
--   personality  -> male users  (PersonalityProfile)
--
-- Design: append-only version history.
-- To read the current profile, always query:
--   ORDER BY version DESC LIMIT 1

CREATE TABLE IF NOT EXISTS ai_assistant_profiles (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_type text       NOT NULL CHECK (profile_type IN ('preferences', 'personality')),
  data        jsonb       NOT NULL DEFAULT '{}',
  version     integer     NOT NULL DEFAULT 1,
  reason      text        NOT NULL DEFAULT 'Initial profile',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup: user + type + latest version
CREATE INDEX IF NOT EXISTS idx_ai_assistant_profiles_user_type_version
  ON ai_assistant_profiles (user_id, profile_type, version DESC);

-- RLS
ALTER TABLE ai_assistant_profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read their own profiles.
-- Server-side code uses the service key, which bypasses RLS entirely.
CREATE POLICY "Users can read own profiles" ON ai_assistant_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profiles" ON ai_assistant_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
