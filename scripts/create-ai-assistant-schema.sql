-- ============================================================================
-- AI Assistant Schema
-- Run this in your Supabase SQL editor
-- ============================================================================

-- AI Assistant conversations table
CREATE TABLE IF NOT EXISTS ai_assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_conversation_id UUID NOT NULL,
  assistant_type TEXT NOT NULL CHECK (assistant_type IN ('bestie', 'wingman')),
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_assistant_conversations_user_id 
  ON ai_assistant_conversations(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_assistant_conversations_match_conversation_id 
  ON ai_assistant_conversations(match_conversation_id);

CREATE INDEX IF NOT EXISTS idx_ai_assistant_conversations_user_type 
  ON ai_assistant_conversations(user_id, assistant_type);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE ai_assistant_conversations ENABLE ROW LEVEL SECURITY;

-- Each user can only read/write their own AI assistant conversations
CREATE POLICY "ai_assistant_conversations_select" ON ai_assistant_conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "ai_assistant_conversations_insert" ON ai_assistant_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_assistant_conversations_update" ON ai_assistant_conversations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "ai_assistant_conversations_delete" ON ai_assistant_conversations
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- Auto-update updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_ai_assistant_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_assistant_conversations_updated_at ON ai_assistant_conversations;
CREATE TRIGGER trg_ai_assistant_conversations_updated_at
  BEFORE UPDATE ON ai_assistant_conversations
  FOR EACH ROW EXECUTE FUNCTION update_ai_assistant_updated_at();
