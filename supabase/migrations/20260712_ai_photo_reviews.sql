-- ============================================================================
-- ai_photo_reviews
-- Human tags on AI-generated profile photos, applied from the admin Test Suite
-- "AI Photos" tab. Each row is one reviewer's judgement of one image.
--
-- Photos live in two places (there is no dedicated photo-generation table):
--   • existing  — user_master_profile.data.aiPhotos[] ({ url, role, scene })
--   • generated — fresh output from /api/photo-enhance/generate (hosted in the
--                 `profiles` storage bucket under ai-photos/)
-- We key a review by the photo's public URL, so both sources are taggable.
--
-- A given (photo_url, reviewer) pair is unique: re-tagging upserts in place, and
-- multiple reviewers can independently tag the same image.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_photo_reviews (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_url           TEXT        NOT NULL,
  -- The user the photo belongs to (null for ad-hoc "Generate" bench output).
  user_id             UUID        REFERENCES verified_vibe_users(id) ON DELETE SET NULL,
  role                TEXT,       -- lead | warmth | lifestyle | conversation | social
  scene               TEXT,
  source              TEXT        NOT NULL DEFAULT 'existing', -- 'existing' | 'generated'
  -- Tag payload -----------------------------------------------------------------
  identity_preserved  TEXT,       -- 'yes' | 'partial' | 'no'
  has_artifacts       BOOLEAN,    -- visible AI artifacts / distortion
  quality             SMALLINT,   -- overall usability, 1..5
  note                TEXT,       -- free-text reviewer comment
  -- Reviewer defaults to 'anonymous' so the (url, reviewer) unique key holds even
  -- when the admin session never set a reviewer name cookie.
  reviewer            TEXT        NOT NULL DEFAULT 'anonymous',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_photo_reviews_url_reviewer_unique UNIQUE (photo_url, reviewer)
);

CREATE INDEX IF NOT EXISTS idx_ai_photo_reviews_user_id
  ON ai_photo_reviews (user_id);

CREATE INDEX IF NOT EXISTS idx_ai_photo_reviews_created_at
  ON ai_photo_reviews (created_at DESC);

-- ── Row-Level Security ────────────────────────────────────────────────────────
-- Reviews are admin-only data. The admin console reads/writes them through the
-- service-role client (RLS bypassed); no end-user policy is granted.

ALTER TABLE ai_photo_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_photo_reviews_service_all"
  ON ai_photo_reviews FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_ai_photo_reviews_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ai_photo_reviews_updated_at
  BEFORE UPDATE ON ai_photo_reviews
  FOR EACH ROW EXECUTE FUNCTION update_ai_photo_reviews_updated_at();
