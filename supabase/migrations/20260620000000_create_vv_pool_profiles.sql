-- Unified Matchmaker pool table
--
-- Collapses vv_pool_wingmen + vv_pool_besties into ONE gender-neutral table.
-- The two source tables are intentionally LEFT IN PLACE (not dropped) so the
-- current matchmaker keeps working until consumers are migrated over.
--
-- Design (see chat discussion):
--   assistant_type  — 'wingman' (men) | 'bestie' (women), mirroring the existing
--                     ai_assistant_* convention. Derived purely from gender at
--                     enrollment; prefer_not_to_say users are NOT enrolled.
--   match_profile   — "who I am" (self / public-facing), the SUPERSET of both
--                     genders' fields. Merges:
--                       bio (M) + publicIntro (F)        → publicIntro
--                       whatSheValues (F)                → values  (neutral rename)
--                     archetype + city are top-level columns, NOT inside the JSON.
--   preferences     — "what I want", the SUPERSET of both genders' fields. Merges:
--                       lookingFor (M) + relationshipIntent (F) → lookingFor
--                       (both already come from the same deriveIntent()).
--
-- Fields with no source for a given gender are kept PRESENT but EMPTY ('' / []),
-- so the shape is identical for every row.

CREATE TABLE IF NOT EXISTS vv_pool_profiles (
  user_id             UUID PRIMARY KEY REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  assistant_type      TEXT NOT NULL CHECK (assistant_type IN ('wingman', 'bestie')),
  archetype           TEXT NOT NULL,
  trust_score_band    TEXT NOT NULL,
  city                TEXT,
  match_profile       JSONB NOT NULL DEFAULT '{}',
  preferences         JSONB NOT NULL DEFAULT '{}',
  availability_status TEXT NOT NULL DEFAULT 'active' CHECK (availability_status IN ('active', 'paused')),
  last_updated        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vv_pool_profiles_assistant    ON vv_pool_profiles (assistant_type);
CREATE INDEX IF NOT EXISTS idx_vv_pool_profiles_city         ON vv_pool_profiles (city);
CREATE INDEX IF NOT EXISTS idx_vv_pool_profiles_archetype    ON vv_pool_profiles (archetype);
CREATE INDEX IF NOT EXISTS idx_vv_pool_profiles_trust        ON vv_pool_profiles (trust_score_band);
CREATE INDEX IF NOT EXISTS idx_vv_pool_profiles_availability ON vv_pool_profiles (availability_status);

-- ── Row Level Security (mirrors vv_pool_wingmen / vv_pool_besties) ─────────────
ALTER TABLE vv_pool_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vv_pool_profiles_self"    ON vv_pool_profiles FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vv_pool_profiles_service" ON vv_pool_profiles FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ── Backfill from vv_pool_wingmen (men) ───────────────────────────────────────
INSERT INTO vv_pool_profiles (
  user_id, assistant_type, archetype, trust_score_band, city,
  match_profile, preferences, availability_status, last_updated
)
SELECT
  w.user_id,
  'wingman',
  w.archetype,
  w.trust_score_band,
  w.city,
  jsonb_build_object(
    'publicIntro',            COALESCE(w.match_profile->>'bio', ''),
    'headline',               '',
    'intentStatement',        COALESCE(w.match_profile->>'intentStatement', ''),
    'personalityDescriptors', COALESCE(w.match_profile->'personalityDescriptors', '[]'::jsonb),
    'values',                 '[]'::jsonb,
    'compatibilitySignals',   '[]'::jsonb,
    'conversationHooks',      '[]'::jsonb,
    'lifestyleTags',          COALESCE(w.match_profile->'lifestyleTags', '[]'::jsonb),
    'countriesTraveled',      COALESCE(w.match_profile->'countriesTraveled', '[]'::jsonb),
    'topProofSignals',        COALESCE(w.match_profile->'topProofSignals', '[]'::jsonb),
    'proofCategories',        COALESCE(w.match_profile->'proofCategories', '[]'::jsonb)
  ),
  jsonb_build_object(
    'lookingFor',             COALESCE(w.preference_signals->>'lookingFor', ''),
    'dealbreakers',           COALESCE(w.preference_signals->'dealbreakers', '[]'::jsonb),
    'emotionalSignals',       COALESCE(w.preference_signals->'emotionalSignals', '[]'::jsonb),
    'lifestyleSignals',       '[]'::jsonb,
    'maturitySignals',        '[]'::jsonb
  ),
  w.availability_status,
  w.last_updated
FROM vv_pool_wingmen w
ON CONFLICT (user_id) DO NOTHING;

-- ── Backfill from vv_pool_besties (women) ─────────────────────────────────────
INSERT INTO vv_pool_profiles (
  user_id, assistant_type, archetype, trust_score_band, city,
  match_profile, preferences, availability_status, last_updated
)
SELECT
  b.user_id,
  'bestie',
  b.archetype,
  b.trust_score_band,
  b.city,
  jsonb_build_object(
    'publicIntro',            COALESCE(b.match_profile->>'publicIntro', ''),
    'headline',               COALESCE(b.match_profile->>'headline', ''),
    'intentStatement',        '',
    'personalityDescriptors', '[]'::jsonb,
    'values',                 COALESCE(b.match_profile->'whatSheValues', '[]'::jsonb),
    'compatibilitySignals',   COALESCE(b.match_profile->'compatibilitySignals', '[]'::jsonb),
    'conversationHooks',      COALESCE(b.match_profile->'conversationHooks', '[]'::jsonb),
    'lifestyleTags',          '[]'::jsonb,
    'countriesTraveled',      '[]'::jsonb,
    'topProofSignals',        COALESCE(b.match_profile->'topProofSignals', '[]'::jsonb),
    'proofCategories',        COALESCE(b.match_profile->'proofCategories', '[]'::jsonb)
  ),
  jsonb_build_object(
    'lookingFor',             COALESCE(b.preference_model->>'relationshipIntent', ''),
    'dealbreakers',           COALESCE(b.preference_model->'dealbreakers', '[]'::jsonb),
    'emotionalSignals',       COALESCE(b.preference_model->'emotionalSignals', '[]'::jsonb),
    'lifestyleSignals',       COALESCE(b.preference_model->'lifestyleSignals', '[]'::jsonb),
    'maturitySignals',        COALESCE(b.preference_model->'maturitySignals', '[]'::jsonb)
  ),
  b.availability_status,
  b.last_updated
FROM vv_pool_besties b
ON CONFLICT (user_id) DO NOTHING;
