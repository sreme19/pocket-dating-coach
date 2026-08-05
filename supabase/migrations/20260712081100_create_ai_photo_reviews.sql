CREATE TABLE IF NOT EXISTS ai_photo_reviews (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_url           TEXT        NOT NULL,
  user_id             UUID        REFERENCES verified_vibe_users(id) ON DELETE SET NULL,
  role                TEXT,
  scene               TEXT,
  source              TEXT        NOT NULL DEFAULT 'existing',
  identity_preserved  TEXT,
  has_artifacts       BOOLEAN,
  quality             SMALLINT,
  note                TEXT,
  reviewer            TEXT        NOT NULL DEFAULT 'anonymous',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_photo_reviews_url_reviewer_unique UNIQUE (photo_url, reviewer)
);

CREATE INDEX IF NOT EXISTS idx_ai_photo_reviews_user_id
  ON ai_photo_reviews (user_id);

CREATE INDEX IF NOT EXISTS idx_ai_photo_reviews_created_at
  ON ai_photo_reviews (created_at DESC);

ALTER TABLE ai_photo_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_photo_reviews_service_all"
  ON ai_photo_reviews FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_ai_photo_reviews_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ai_photo_reviews_updated_at
  BEFORE UPDATE ON ai_photo_reviews
  FOR EACH ROW EXECUTE FUNCTION update_ai_photo_reviews_updated_at();;
