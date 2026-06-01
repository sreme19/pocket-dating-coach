ALTER TABLE verified_vibe_users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_vvu_last_active_at ON verified_vibe_users (last_active_at);

CREATE TABLE IF NOT EXISTS vv_pool_wingmen (
  user_id UUID PRIMARY KEY REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  archetype TEXT NOT NULL,
  trust_score_band TEXT NOT NULL,
  city TEXT,
  match_profile JSONB NOT NULL DEFAULT '{}',
  preference_signals JSONB NOT NULL DEFAULT '{}',
  availability_status TEXT NOT NULL DEFAULT 'active' CHECK (availability_status IN ('active', 'paused')),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vv_pool_wingmen_city ON vv_pool_wingmen (city);
CREATE INDEX IF NOT EXISTS idx_vv_pool_wingmen_archetype ON vv_pool_wingmen (archetype);
CREATE INDEX IF NOT EXISTS idx_vv_pool_wingmen_trust ON vv_pool_wingmen (trust_score_band);
CREATE INDEX IF NOT EXISTS idx_vv_pool_wingmen_availability ON vv_pool_wingmen (availability_status);

CREATE TABLE IF NOT EXISTS vv_pool_besties (
  user_id UUID PRIMARY KEY REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  archetype TEXT NOT NULL,
  trust_score_band TEXT NOT NULL,
  city TEXT,
  match_profile JSONB NOT NULL DEFAULT '{}',
  preference_model JSONB NOT NULL DEFAULT '{}',
  availability_status TEXT NOT NULL DEFAULT 'active' CHECK (availability_status IN ('active', 'paused')),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vv_pool_besties_city ON vv_pool_besties (city);
CREATE INDEX IF NOT EXISTS idx_vv_pool_besties_archetype ON vv_pool_besties (archetype);
CREATE INDEX IF NOT EXISTS idx_vv_pool_besties_availability ON vv_pool_besties (availability_status);

CREATE TABLE IF NOT EXISTS vv_intelligence_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('pool_competitive', 'per_match_ranking', 'female_competitive')),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('user_driven', 'cold_push', 'weekly')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'delivered')),
  payload JSONB,
  summary TEXT,
  action_list JSONB,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_vv_intelligence_reports_user_status ON vv_intelligence_reports (user_id, status);
CREATE INDEX IF NOT EXISTS idx_vv_intelligence_reports_requested ON vv_intelligence_reports (requested_at);

CREATE TABLE IF NOT EXISTS vv_match_outcome_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL,
  male_user_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  female_user_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('unmatched', 'blocked', 'no_messages', 'converted')),
  initiated_by_gender TEXT CHECK (initiated_by_gender IN ('man', 'woman', 'system')),
  compatibility_score FLOAT,
  male_archetype TEXT,
  female_archetype TEXT,
  male_trust_band TEXT,
  outcome_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vv_match_outcomes_male ON vv_match_outcome_signals (male_user_id);
CREATE INDEX IF NOT EXISTS idx_vv_match_outcomes_female ON vv_match_outcome_signals (female_user_id);
CREATE INDEX IF NOT EXISTS idx_vv_match_outcomes_outcome ON vv_match_outcome_signals (outcome);

CREATE TABLE IF NOT EXISTS vv_matchmaker_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type TEXT NOT NULL CHECK (run_type IN ('nightly', 'on_demand')),
  city TEXT,
  pairs_evaluated INTEGER NOT NULL DEFAULT 0,
  hard_filtered INTEGER NOT NULL DEFAULT 0,
  soft_scored INTEGER NOT NULL DEFAULT 0,
  matches_fired INTEGER NOT NULL DEFAULT 0,
  soft_overrides INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error TEXT
);

CREATE TABLE IF NOT EXISTS vv_proactive_chat_messages (
  user_id UUID PRIMARY KEY REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  report_id UUID REFERENCES vv_intelligence_reports(id) ON DELETE SET NULL,
  report_type TEXT,
  message TEXT NOT NULL,
  delivered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE vv_pool_wingmen ENABLE ROW LEVEL SECURITY;
ALTER TABLE vv_pool_besties ENABLE ROW LEVEL SECURITY;
ALTER TABLE vv_intelligence_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE vv_match_outcome_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE vv_matchmaker_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vv_proactive_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vv_pool_wingmen_self" ON vv_pool_wingmen FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vv_pool_wingmen_service" ON vv_pool_wingmen FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "vv_pool_besties_self" ON vv_pool_besties FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vv_pool_besties_service" ON vv_pool_besties FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "vv_intelligence_reports_self_select" ON vv_intelligence_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "vv_intelligence_reports_service" ON vv_intelligence_reports FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "vv_match_outcome_signals_self_select" ON vv_match_outcome_signals FOR SELECT USING (auth.uid() = male_user_id OR auth.uid() = female_user_id);
CREATE POLICY "vv_match_outcome_signals_service" ON vv_match_outcome_signals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "vv_matchmaker_runs_service" ON vv_matchmaker_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "vv_proactive_chat_messages_self" ON vv_proactive_chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "vv_proactive_chat_messages_service" ON vv_proactive_chat_messages FOR ALL TO service_role USING (true) WITH CHECK (true);;
