-- ============================================================================
-- AI Greeting System — History, Feedback, Context, Violations
-- Created: 2026-05-29
-- ============================================================================

-- ── 1. Greeting messages sent by the AI assistant to the profile owner ───────
CREATE TABLE IF NOT EXISTS ai_assistant_greetings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assistant_type  TEXT NOT NULL CHECK (assistant_type IN ('wingman', 'bestie')),
  mode            INTEGER NOT NULL DEFAULT 0, -- 0=intro,1=early,2=active,3=competitive
  content         TEXT NOT NULL,
  topic_tags      TEXT[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_greetings_user_time
  ON ai_assistant_greetings(user_id, created_at DESC);

-- ── 2. Feedback on individual greeting messages ──────────────────────────────
CREATE TABLE IF NOT EXISTS ai_assistant_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  greeting_id     UUID REFERENCES ai_assistant_greetings(id) ON DELETE SET NULL,
  rating          INTEGER NOT NULL CHECK (rating IN (1, -1)),
  reason_chip     TEXT,   -- 'too_generic'|'not_relevant'|'wrong_tone'|'factually_off'|'other'
  feedback_text   TEXT,
  needs_review    BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_at     TIMESTAMPTZ,
  reviewer_notes  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON ai_assistant_feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_review ON ai_assistant_feedback(needs_review, reviewed_at)
  WHERE needs_review = TRUE;

-- ── 3. Per-user accumulated optimisation context ─────────────────────────────
CREATE TABLE IF NOT EXISTS ai_assistant_context (
  user_id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  assistant_type      TEXT NOT NULL CHECK (assistant_type IN ('wingman', 'bestie')),
  session_count       INTEGER NOT NULL DEFAULT 0,
  first_seen_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_greeted_at     TIMESTAMPTZ,
  feedback_summary    TEXT,   -- Haiku-written optimisation paragraph
  avoid_patterns      TEXT[] NOT NULL DEFAULT '{}',
  works_well          TEXT[] NOT NULL DEFAULT '{}',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. Compliance violation log ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_assistant_violations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assistant_type   TEXT CHECK (assistant_type IN ('wingman', 'bestie')),
  original_content TEXT NOT NULL,
  sanitized_sent   TEXT,            -- what was actually sent (fallback)
  violation_types  TEXT[] NOT NULL DEFAULT '{}',
  detection_stage  TEXT NOT NULL CHECK (detection_stage IN ('regex','haiku_validator','user_report')),
  needs_review     BOOLEAN NOT NULL DEFAULT TRUE,
  reviewed_at      TIMESTAMPTZ,
  reviewer_notes   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_violations_review
  ON ai_assistant_violations(needs_review, created_at DESC)
  WHERE needs_review = TRUE;

-- ── RLS policies ─────────────────────────────────────────────────────────────
ALTER TABLE ai_assistant_greetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_assistant_feedback  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_assistant_context   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_assistant_violations ENABLE ROW LEVEL SECURITY;

-- Users can read their own data; service role bypasses all policies
CREATE POLICY "users_own_greetings" ON ai_assistant_greetings
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_feedback" ON ai_assistant_feedback
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_context" ON ai_assistant_context
  FOR ALL USING (auth.uid() = user_id);
-- Violations: write-only for users (they can submit but not read)
CREATE POLICY "users_insert_violations" ON ai_assistant_violations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE ai_assistant_greetings  IS 'Proactive greeting messages sent by AI Wingman/Bestie on each session.';
COMMENT ON TABLE ai_assistant_feedback   IS 'User feedback (thumbs up/down + optional reason) on greeting messages.';
COMMENT ON TABLE ai_assistant_context    IS 'Accumulated optimisation context per user — updated after each feedback event.';
COMMENT ON TABLE ai_assistant_violations IS 'PII and guideline violations caught before delivery. Reviewed by internal team.';
