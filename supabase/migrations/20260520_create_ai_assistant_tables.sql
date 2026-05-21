-- Migration: Create AI Assistant Tables for AI Bestie & AI Wingman Integration
-- Purpose: Set up database schema for storing AI assistant profiles, conversations, summaries, and configurations
-- Created: 2025-01-20

-- ============================================================================
-- TABLE 1: ai_assistant_profiles
-- ============================================================================
-- Purpose: Stores user preferences.md and personality.md with version history tracking
-- Tracks: Female user preferences and male user personality profiles
-- Features: Version control, reason tracking, current version flag

CREATE TABLE IF NOT EXISTS ai_assistant_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_type TEXT NOT NULL CHECK (profile_type IN ('preferences', 'personality')),
  data JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  is_current BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, profile_type, version)
);

-- Index for quick lookup by user and profile type
CREATE INDEX IF NOT EXISTS idx_ai_profiles_user_type ON ai_assistant_profiles(user_id, profile_type);

-- Index for sorting by update time (for retrieving latest profiles)
CREATE INDEX IF NOT EXISTS idx_ai_profiles_updated ON ai_assistant_profiles(updated_at DESC);

-- Index for quickly finding current profile (filtered index for performance)
CREATE INDEX IF NOT EXISTS idx_ai_profiles_current ON ai_assistant_profiles(user_id, profile_type) WHERE is_current = TRUE;

-- ============================================================================
-- TABLE 2: ai_assistant_conversations
-- ============================================================================
-- Purpose: Stores conversation history between user and AI assistant
-- Tracks: Messages exchanged with AI Bestie or AI Wingman for each match
-- Features: Active status tracking, exchange counting for loop prevention, timestamps

CREATE TABLE IF NOT EXISTS ai_assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_conversation_id TEXT NOT NULL,
  assistant_type TEXT NOT NULL CHECK (assistant_type IN ('bestie', 'wingman')),
  messages JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  exchange_count INTEGER DEFAULT 0,
  last_exchange_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, match_conversation_id, assistant_type)
);

-- Index for quick lookup by user
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_assistant_conversations(user_id);

-- Index for filtering active conversations
CREATE INDEX IF NOT EXISTS idx_ai_conversations_active ON ai_assistant_conversations(is_active);

-- Index for finding conversations by match ID
CREATE INDEX IF NOT EXISTS idx_ai_conversations_match ON ai_assistant_conversations(match_conversation_id);

-- Index for sorting by update time (for retrieving recent conversations)
CREATE INDEX IF NOT EXISTS idx_ai_conversations_updated ON ai_assistant_conversations(updated_at DESC);

-- ============================================================================
-- TABLE 3: ai_assistant_summaries
-- ============================================================================
-- Purpose: Stores hourly summaries of all matches with AI Bestie insights
-- Tracks: Daily aggregated insights, compatibility signals, recommended next moves
-- Features: One summary per user per day, automatic deduplication

CREATE TABLE IF NOT EXISTS ai_assistant_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, DATE(created_at))
);

-- Index for quick lookup by user and date (for retrieving summaries)
CREATE INDEX IF NOT EXISTS idx_summaries_user_date ON ai_assistant_summaries(user_id, created_at DESC);

-- ============================================================================
-- TABLE 4: ai_assistant_configs
-- ============================================================================
-- Purpose: Stores assistant settings and configuration for each user
-- Tracks: Enable/disable status, auto-impersonation settings, assistant preferences
-- Features: Per-user, per-assistant configuration

CREATE TABLE IF NOT EXISTS ai_assistant_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assistant_type TEXT NOT NULL CHECK (assistant_type IN ('bestie', 'wingman')),
  config_data JSONB NOT NULL DEFAULT '{}',
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, assistant_type)
);

-- Index for quick lookup by user and assistant type
CREATE INDEX IF NOT EXISTS idx_ai_configs_user_type ON ai_assistant_configs(user_id, assistant_type);

-- ============================================================================
-- TABLE 5: ai_assistant_match_configs
-- ============================================================================
-- Purpose: Stores per-match assistant configuration and state
-- Tracks: Active status, auto-impersonation, exchange counts for loop prevention
-- Features: Per-match, per-assistant configuration for managing individual conversations

CREATE TABLE IF NOT EXISTS ai_assistant_match_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id TEXT NOT NULL,
  assistant_type TEXT NOT NULL CHECK (assistant_type IN ('bestie', 'wingman')),
  is_active BOOLEAN DEFAULT FALSE,
  auto_impersonate BOOLEAN DEFAULT FALSE,
  exchange_count INTEGER DEFAULT 0,
  last_exchange_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, match_id, assistant_type)
);

-- Index for quick lookup by user and match
CREATE INDEX IF NOT EXISTS idx_ai_match_configs_user_match ON ai_assistant_match_configs(user_id, match_id);

-- Index for filtering active assistants
CREATE INDEX IF NOT EXISTS idx_ai_match_configs_active ON ai_assistant_match_configs(is_active);

-- Index for sorting by update time
CREATE INDEX IF NOT EXISTS idx_ai_match_configs_updated ON ai_assistant_match_configs(updated_at DESC);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE ai_assistant_profiles IS 'Stores user preferences.md (for women) and personality.md (for men) with version history tracking. Enables profile versioning and rollback functionality.';

COMMENT ON COLUMN ai_assistant_profiles.profile_type IS 'Type of profile: "preferences" for female users, "personality" for male users';

COMMENT ON COLUMN ai_assistant_profiles.data IS 'JSONB data containing the full profile content (preferences or personality)';

COMMENT ON COLUMN ai_assistant_profiles.version IS 'Version number for this profile (increments with each update)';

COMMENT ON COLUMN ai_assistant_profiles.reason IS 'Reason for the profile update (e.g., "Updated based on recent conversations")';

COMMENT ON COLUMN ai_assistant_profiles.is_current IS 'Flag indicating if this is the current active version of the profile';

COMMENT ON TABLE ai_assistant_conversations IS 'Stores conversation history between user and AI assistant (Bestie or Wingman). One conversation per user-match-assistant combination.';

COMMENT ON COLUMN ai_assistant_conversations.match_conversation_id IS 'Reference to the match conversation ID from the dating app';

COMMENT ON COLUMN ai_assistant_conversations.assistant_type IS 'Type of assistant: "bestie" for female users, "wingman" for male users';

COMMENT ON COLUMN ai_assistant_conversations.messages IS 'JSONB array of messages in the conversation (user and assistant messages)';

COMMENT ON COLUMN ai_assistant_conversations.is_active IS 'Flag indicating if this conversation session is currently active';

COMMENT ON COLUMN ai_assistant_conversations.exchange_count IS 'Counter for AI Loop Prevention: tracks number of exchanges to prevent infinite loops when both assistants are active';

COMMENT ON COLUMN ai_assistant_conversations.last_exchange_at IS 'Timestamp of the last message exchange (used for loop prevention timing)';

COMMENT ON TABLE ai_assistant_summaries IS 'Stores hourly/daily summaries of all matches with AI Bestie insights. One summary per user per day.';

COMMENT ON COLUMN ai_assistant_summaries.summary_data IS 'JSONB data containing aggregated insights, compatibility signals, and recommended next moves for all matches';

COMMENT ON TABLE ai_assistant_configs IS 'Stores configuration and settings for each AI assistant per user. Controls enable/disable status and assistant-specific preferences.';

COMMENT ON COLUMN ai_assistant_configs.config_data IS 'JSONB data containing assistant-specific configuration (e.g., auto-impersonation settings, rate limiting preferences)';

COMMENT ON COLUMN ai_assistant_configs.is_enabled IS 'Flag indicating if this assistant is enabled for the user';

COMMENT ON TABLE ai_assistant_match_configs IS 'Stores per-match assistant configuration and state. Tracks active status, auto-impersonation settings, and exchange counts for loop prevention.';

COMMENT ON COLUMN ai_assistant_match_configs.match_id IS 'Reference to the match ID from the dating app';

COMMENT ON COLUMN ai_assistant_match_configs.assistant_type IS 'Type of assistant: "bestie" for female users, "wingman" for male users';

COMMENT ON COLUMN ai_assistant_match_configs.is_active IS 'Flag indicating if this assistant is currently active for this match';

COMMENT ON COLUMN ai_assistant_match_configs.auto_impersonate IS 'Flag for Wingman: whether to auto-send responses after 20+ messages from match';

COMMENT ON COLUMN ai_assistant_match_configs.exchange_count IS 'Counter for AI Loop Prevention: tracks number of exchanges to prevent infinite loops';

COMMENT ON COLUMN ai_assistant_match_configs.last_exchange_at IS 'Timestamp of the last message exchange (used for loop prevention timing)';
