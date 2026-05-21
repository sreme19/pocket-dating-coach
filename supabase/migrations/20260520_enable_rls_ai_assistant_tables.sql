-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR AI ASSISTANT TABLES
-- Pocket Dating Coach - AI Bestie & AI Wingman Integration
-- ============================================================================
-- Purpose: Enable RLS on all AI assistant tables and create policies to ensure
--          users can only access their own data
-- Tables: ai_assistant_profiles, ai_assistant_conversations, ai_assistant_summaries, ai_assistant_configs
-- ============================================================================

-- ============================================================================
-- TABLE 1: ai_assistant_profiles
-- ============================================================================
-- Purpose: Stores user preferences.md and personality.md with version history
-- Policy: Users can only access their own profiles

ALTER TABLE ai_assistant_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profiles
CREATE POLICY "Users can view their own profiles" ON ai_assistant_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own profiles
CREATE POLICY "Users can insert their own profiles" ON ai_assistant_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own profiles
CREATE POLICY "Users can update their own profiles" ON ai_assistant_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own profiles
CREATE POLICY "Users can delete their own profiles" ON ai_assistant_profiles
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- TABLE 2: ai_assistant_conversations
-- ============================================================================
-- Purpose: Stores conversation history between user and AI assistant
-- Policy: Users can only access their own conversations

ALTER TABLE ai_assistant_conversations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own conversations
CREATE POLICY "Users can view their own conversations" ON ai_assistant_conversations
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own conversations
CREATE POLICY "Users can insert their own conversations" ON ai_assistant_conversations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own conversations
CREATE POLICY "Users can update their own conversations" ON ai_assistant_conversations
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own conversations
CREATE POLICY "Users can delete their own conversations" ON ai_assistant_conversations
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- TABLE 3: ai_assistant_summaries
-- ============================================================================
-- Purpose: Stores hourly summaries of all matches with AI Bestie insights
-- Policy: Users can only access their own summaries

ALTER TABLE ai_assistant_summaries ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own summaries
CREATE POLICY "Users can view their own summaries" ON ai_assistant_summaries
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own summaries
CREATE POLICY "Users can insert their own summaries" ON ai_assistant_summaries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own summaries
CREATE POLICY "Users can update their own summaries" ON ai_assistant_summaries
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own summaries
CREATE POLICY "Users can delete their own summaries" ON ai_assistant_summaries
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- TABLE 4: ai_assistant_configs
-- ============================================================================
-- Purpose: Stores assistant settings and configuration for each user
-- Policy: Users can only access their own configs

ALTER TABLE ai_assistant_configs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own configs
CREATE POLICY "Users can view their own configs" ON ai_assistant_configs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own configs
CREATE POLICY "Users can insert their own configs" ON ai_assistant_configs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own configs
CREATE POLICY "Users can update their own configs" ON ai_assistant_configs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own configs
CREATE POLICY "Users can delete their own configs" ON ai_assistant_configs
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- VERIFICATION COMMENTS
-- ============================================================================
-- All RLS policies follow the same pattern:
-- - SELECT: Users can only view rows where auth.uid() = user_id
-- - INSERT: Users can only insert rows where auth.uid() = user_id
-- - UPDATE: Users can only update rows where auth.uid() = user_id
-- - DELETE: Users can only delete rows where auth.uid() = user_id
--
-- This ensures complete data isolation between users. Each user can only:
-- 1. View their own profiles, conversations, summaries, and configs
-- 2. Create new profiles, conversations, summaries, and configs for themselves
-- 3. Update their own profiles, conversations, summaries, and configs
-- 4. Delete their own profiles, conversations, summaries, and configs
--
-- No user can access, modify, or delete another user's data.
-- ============================================================================
