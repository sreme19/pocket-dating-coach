-- Phase 1 of the two-sided weighted-value redesign — SHADOW scoring columns.
--
-- The vector scoring engine (src/lib/server/vector-scoring.ts) computes appeal
-- and Profile Strength as pure arithmetic over vv_user_vectors. Phase 1 writes
-- those results ALONGSIDE the existing opaque-LLM scores so we can diff old↔new
-- before any cutover. Nothing on the live path reads these *_v2 columns yet.
--
-- Rollback path:
--   ALTER TABLE vv_match_scores  DROP COLUMN appeal_to_her_v2, DROP COLUMN appeal_to_him_v2,
--                                DROP COLUMN mutual_value_v2, DROP COLUMN scored_v2_at;
--   ALTER TABLE vv_user_vectors  DROP COLUMN profile_strength, DROP COLUMN profile_strength_band;

-- Shadow directional appeal + mutual value, vector-computed (compare to the live
-- appeal_to_her / appeal_to_him produced by the LLM scorer).
ALTER TABLE vv_match_scores ADD COLUMN IF NOT EXISTS appeal_to_her_v2 integer;
ALTER TABLE vv_match_scores ADD COLUMN IF NOT EXISTS appeal_to_him_v2 integer;
ALTER TABLE vv_match_scores ADD COLUMN IF NOT EXISTS mutual_value_v2  integer;
ALTER TABLE vv_match_scores ADD COLUMN IF NOT EXISTS scored_v2_at     timestamptz;

-- Profile Strength (open dims only) is a per-user property — store on the vectors row.
ALTER TABLE vv_user_vectors ADD COLUMN IF NOT EXISTS profile_strength      integer;
ALTER TABLE vv_user_vectors ADD COLUMN IF NOT EXISTS profile_strength_band text;
