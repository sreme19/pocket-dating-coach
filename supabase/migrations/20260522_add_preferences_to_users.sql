-- Add preferences column to verified_vibe_users
-- Stores a JSON object with the user's dating preferences, values, and lifestyle info
-- Updated during onboarding and whenever user provides self-insights during chat

ALTER TABLE verified_vibe_users
  ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

-- Index for faster queries on preferences
CREATE INDEX IF NOT EXISTS idx_verified_vibe_users_preferences ON verified_vibe_users USING GIN (preferences);
