-- ============================================================================
-- Advisor (global) chat persistence + QA review support
-- Created: 2026-06-01
-- ============================================================================

-- ── 1. Advisor chat transcripts (one canonical thread per user + assistant) ──
CREATE TABLE IF NOT EXISTS ai_assistant_advisor_chats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assistant_type  TEXT NOT NULL CHECK (assistant_type IN ('wingman', 'bestie')),
  -- [{ role: 'user' | 'assistant', content: text, ts: ISO-8601 string }]
  messages        JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, assistant_type)
);

CREATE INDEX IF NOT EXISTS idx_advisor_chats_user_time
  ON ai_assistant_advisor_chats (user_id, updated_at DESC);

-- Service-role-only access (admin QA + server endpoints), matching the rest of
-- the AI assistant tables.
ALTER TABLE ai_assistant_advisor_chats ENABLE ROW LEVEL SECURITY;

-- ── 2. Let a QA review target an advisor chat instead of a match thread ──────
ALTER TABLE ai_qa_reviews ALTER COLUMN match_id DROP NOT NULL;

ALTER TABLE ai_qa_reviews
  ADD COLUMN IF NOT EXISTS advisor_chat_id UUID
  REFERENCES ai_assistant_advisor_chats(id) ON DELETE CASCADE;

-- Exactly one review target: a match thread XOR an advisor chat.
ALTER TABLE ai_qa_reviews
  DROP CONSTRAINT IF EXISTS chk_ai_qa_reviews_target;

ALTER TABLE ai_qa_reviews
  ADD CONSTRAINT chk_ai_qa_reviews_target
  CHECK ((match_id IS NOT NULL) <> (advisor_chat_id IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_ai_qa_reviews_advisor
  ON ai_qa_reviews(advisor_chat_id);;
