CREATE TABLE IF NOT EXISTS vv_ledger_topics (
  key         TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  origin      TEXT NOT NULL DEFAULT 'seed',
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO vv_ledger_topics (key, label, origin) VALUES
  ('career',     'Career and work',            'seed'),
  ('intentions', 'What he is looking for',     'seed'),
  ('kids',       'Kids and family plans',      'seed'),
  ('travel',     'Travel',                     'seed'),
  ('lifestyle',  'Lifestyle and how he lives', 'seed')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS vv_answer_ledger (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  topic       TEXT NOT NULL REFERENCES vv_ledger_topics (key),
  answer      TEXT NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vv_answer_ledger_user_topic
  ON vv_answer_ledger (user_id, topic, created_at DESC);

ALTER TABLE vv_ledger_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE vv_answer_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_vv_ledger_topics" ON vv_ledger_topics;
CREATE POLICY "service_role_all_vv_ledger_topics"
  ON vv_ledger_topics FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_vv_answer_ledger" ON vv_answer_ledger;
CREATE POLICY "service_role_all_vv_answer_ledger"
  ON vv_answer_ledger FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE verified_vibe_users
  ADD COLUMN IF NOT EXISTS ledger_consent                    TEXT NOT NULL DEFAULT 'unasked',
  ADD COLUMN IF NOT EXISTS ledger_declines                   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ledger_opportunities_since_ask    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ledger_consent_at                 TIMESTAMP WITH TIME ZONE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'verified_vibe_users_ledger_consent_check'
  ) THEN
    ALTER TABLE verified_vibe_users
      ADD CONSTRAINT verified_vibe_users_ledger_consent_check
      CHECK (ledger_consent IN ('unasked', 'granted', 'declined'));
  END IF;
END $$;

ALTER TABLE verified_vibe_matches
  ADD COLUMN IF NOT EXISTS bestie_consent_asked_at TIMESTAMP WITH TIME ZONE;;
