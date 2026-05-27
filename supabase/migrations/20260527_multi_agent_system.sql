-- ============================================================================
-- Multi-Agent System: AI Wingman · AI Bestie · AI Matchmaker
-- Migration: 20260527_multi_agent_system.sql
-- ============================================================================

-- ── 1. last_active_at on verified_vibe_users ─────────────────────────────────
-- Used by cold-user detection (7-day threshold triggers proactive intelligence push)

ALTER TABLE verified_vibe_users
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_vvu_last_active_at
  ON verified_vibe_users (last_active_at);

-- ── 2. Pool registry — AI Wingmen (one row per verified male user) ────────────
-- Written by the pool-registry service when a male user completes verification
-- or updates their master profile. Read by AI Matchmaker.

CREATE TABLE IF NOT EXISTS vv_pool_wingmen (
  user_id             UUID        PRIMARY KEY REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  archetype           TEXT        NOT NULL,
  trust_score_band    TEXT        NOT NULL,   -- e.g. '0-39','40-59','60-69','70-84','85-94','95+'
  city                TEXT,                   -- Phase 1: from profile field; Phase 2: GPS-resolved
  match_profile       JSONB       NOT NULL DEFAULT '{}',
  -- distilled Matchmaker-safe summary: { bio, lifestyleTags, intentStatement,
  --   topProofSignals[], countriesTraveled[], personalityDescriptors[] }
  preference_signals  JSONB       NOT NULL DEFAULT '{}',
  -- { dealbreakers: string[], lookingFor: string, emotionalSignals: string[] }
  availability_status TEXT        NOT NULL DEFAULT 'active'
                        CHECK (availability_status IN ('active', 'paused')),
  last_updated        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vv_pool_wingmen_city
  ON vv_pool_wingmen (city);
CREATE INDEX IF NOT EXISTS idx_vv_pool_wingmen_archetype
  ON vv_pool_wingmen (archetype);
CREATE INDEX IF NOT EXISTS idx_vv_pool_wingmen_trust
  ON vv_pool_wingmen (trust_score_band);
CREATE INDEX IF NOT EXISTS idx_vv_pool_wingmen_availability
  ON vv_pool_wingmen (availability_status);

-- ── 3. Pool registry — AI Besties (one row per verified female user) ──────────

CREATE TABLE IF NOT EXISTS vv_pool_besties (
  user_id             UUID        PRIMARY KEY REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  archetype           TEXT        NOT NULL,
  trust_score_band    TEXT        NOT NULL,
  city                TEXT,
  match_profile       JSONB       NOT NULL DEFAULT '{}',
  -- distilled Matchmaker-safe summary: { compatibilitySignals[], headline,
  --   whatSheValues[], conversationHooks[] }
  preference_model    JSONB       NOT NULL DEFAULT '{}',
  -- normalized (no raw sensitiveTranslations):
  -- { dealbreakers: string[], emotionalSignals: string[], lifestyleSignals: string[],
  --   maturitySignals: string[], relationshipIntent: string }
  availability_status TEXT        NOT NULL DEFAULT 'active'
                        CHECK (availability_status IN ('active', 'paused')),
  last_updated        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vv_pool_besties_city
  ON vv_pool_besties (city);
CREATE INDEX IF NOT EXISTS idx_vv_pool_besties_archetype
  ON vv_pool_besties (archetype);
CREATE INDEX IF NOT EXISTS idx_vv_pool_besties_availability
  ON vv_pool_besties (availability_status);

-- ── 4. Intelligence reports (async — stored until delivered) ─────────────────
-- When a Wingman/Bestie requests intelligence from Matchmaker, a row is created
-- here. Matchmaker processes it asynchronously, sets status='ready', and
-- the push + in-chat delivery follows.

CREATE TABLE IF NOT EXISTS vv_intelligence_reports (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  report_type    TEXT        NOT NULL
                   CHECK (report_type IN (
                     'pool_competitive',   -- how user ranks vs all same-gender pool
                     'per_match_ranking',  -- how male user ranks for each existing female match
                     'female_competitive'  -- how female user competes for high-value men
                   )),
  trigger_type   TEXT        NOT NULL
                   CHECK (trigger_type IN ('user_driven', 'cold_push', 'weekly')),
  status         TEXT        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'processing', 'ready', 'delivered')),
  payload        JSONB,        -- full report data once complete
  summary        TEXT,         -- 1-2 sentence push notification copy
  action_list    JSONB,        -- [{ priority: 1, action: '...', impact: '...' }]
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMPTZ,
  delivered_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_vv_intelligence_reports_user_status
  ON vv_intelligence_reports (user_id, status);
CREATE INDEX IF NOT EXISTS idx_vv_intelligence_reports_requested
  ON vv_intelligence_reports (requested_at);

-- ── 5. Match outcome signals (feedback loop) ─────────────────────────────────
-- Recorded when a match is unmatched, blocked, or converts (continues messaging).
-- Matchmaker reads these to adjust soft scoring weights over time.

CREATE TABLE IF NOT EXISTS vv_match_outcome_signals (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id             UUID        NOT NULL,  -- references verified_vibe_matches(id)
  male_user_id         UUID        NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  female_user_id       UUID        NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  outcome              TEXT        NOT NULL
                         CHECK (outcome IN (
                           'unmatched',     -- one side unmatched
                           'blocked',       -- one side blocked the other
                           'no_messages',   -- matched but never messaged
                           'converted'      -- messaged 5+ times (healthy signal)
                         )),
  initiated_by_gender  TEXT        CHECK (initiated_by_gender IN ('man', 'woman', 'system')),
  compatibility_score  FLOAT,      -- score Matchmaker gave this pair at time of match
  male_archetype       TEXT,
  female_archetype     TEXT,
  male_trust_band      TEXT,
  outcome_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vv_match_outcomes_male
  ON vv_match_outcome_signals (male_user_id);
CREATE INDEX IF NOT EXISTS idx_vv_match_outcomes_female
  ON vv_match_outcome_signals (female_user_id);
CREATE INDEX IF NOT EXISTS idx_vv_match_outcomes_outcome
  ON vv_match_outcome_signals (outcome);

-- ── 6. Matchmaker run log ─────────────────────────────────────────────────────
-- One row per nightly batch or on-demand run. Used for monitoring and debugging.

CREATE TABLE IF NOT EXISTS vv_matchmaker_runs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type         TEXT        NOT NULL CHECK (run_type IN ('nightly', 'on_demand')),
  city             TEXT,       -- NULL = global (Phase 1); city name in Phase 2
  pairs_evaluated  INTEGER     NOT NULL DEFAULT 0,
  hard_filtered    INTEGER     NOT NULL DEFAULT 0,   -- pairs eliminated by hard filters
  soft_scored      INTEGER     NOT NULL DEFAULT 0,   -- pairs that reached Claude scoring
  matches_fired    INTEGER     NOT NULL DEFAULT 0,   -- when-matched events sent
  soft_overrides   INTEGER     NOT NULL DEFAULT 0,   -- dealbreaker overrides surfaced
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  error            TEXT        -- set if the run failed
);

-- ── 7. Proactive in-chat messages ────────────────────────────────────────────
-- One pending row per user. Picked up and cleared when the user next opens
-- their Wingman or Bestie chat. One-at-a-time delivery (upsert on user_id).

CREATE TABLE IF NOT EXISTS vv_proactive_chat_messages (
  user_id      UUID        PRIMARY KEY REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  report_id    UUID        REFERENCES vv_intelligence_reports(id) ON DELETE SET NULL,
  report_type  TEXT,
  message      TEXT        NOT NULL,
  delivered    BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 8. RLS policies ───────────────────────────────────────────────────────────
-- Pool registries: users can read/write only their own row.
-- Intelligence reports: users can read only their own rows.
-- Outcome signals: users can read their own.
-- Service role has unrestricted access for all Matchmaker operations.

ALTER TABLE vv_pool_wingmen        ENABLE ROW LEVEL SECURITY;
ALTER TABLE vv_pool_besties        ENABLE ROW LEVEL SECURITY;
ALTER TABLE vv_intelligence_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE vv_match_outcome_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE vv_matchmaker_runs     ENABLE ROW LEVEL SECURITY;

-- Pool Wingmen
CREATE POLICY "vv_pool_wingmen_self"
  ON vv_pool_wingmen FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vv_pool_wingmen_service"
  ON vv_pool_wingmen FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Pool Besties
CREATE POLICY "vv_pool_besties_self"
  ON vv_pool_besties FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vv_pool_besties_service"
  ON vv_pool_besties FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Intelligence Reports
CREATE POLICY "vv_intelligence_reports_self_select"
  ON vv_intelligence_reports FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "vv_intelligence_reports_service"
  ON vv_intelligence_reports FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Outcome Signals
CREATE POLICY "vv_match_outcome_signals_self_select"
  ON vv_match_outcome_signals FOR SELECT
  USING (auth.uid() = male_user_id OR auth.uid() = female_user_id);
CREATE POLICY "vv_match_outcome_signals_service"
  ON vv_match_outcome_signals FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Matchmaker Runs (read-only for authenticated users, full access for service)
CREATE POLICY "vv_matchmaker_runs_service"
  ON vv_matchmaker_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Proactive Chat Messages
ALTER TABLE vv_proactive_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vv_proactive_chat_messages_self"
  ON vv_proactive_chat_messages FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "vv_proactive_chat_messages_service"
  ON vv_proactive_chat_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
