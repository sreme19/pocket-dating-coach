-- Phase 0 of the two-sided weighted-value redesign (Scoring & Matching Design v0.3).
--
-- SHADOW STORAGE: per-user value vectors over the fixed dimension taxonomy
-- (src/lib/verified-vibe/dimensions.ts — 9 open + 4 sensitive dims). This table
-- is purely additive and is NOT read by any live scoring/matching/advisor path in
-- Phase 0. The vector builder writes it; an admin diff view inspects it. Live
-- behaviour is unchanged until a later phase explicitly switches over.
--
-- Rollback path: DROP TABLE vv_user_vectors;  (nothing on the live path depends on it.)
--
--   attributes  v[d]  — attribute level per dimension, 0–100   ("how much they bring")
--   confidence  c[d]  — confidence per dimension, 0–1          ("how proven it is")
--   weights     w[d]  — this user's preference weight per dim  (Σ over dims = 1)
--                       sourced from the explicit weighting step, LLM extraction
--                       fallback, or balanced cold-start default.
--   All three are JSONB maps keyed by dimension id, so adding a dimension never
--   requires a column migration.

CREATE TABLE IF NOT EXISTS vv_user_vectors (
  user_id        uuid PRIMARY KEY REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  attributes     jsonb NOT NULL DEFAULT '{}'::jsonb,   -- v[d]  0–100
  confidence     jsonb NOT NULL DEFAULT '{}'::jsonb,   -- c[d]  0–1
  weights        jsonb NOT NULL DEFAULT '{}'::jsonb,   -- w[d]  Σ=1
  weights_source text,                                  -- 'explicit' | 'extracted' | 'balanced'
  -- Provenance so the builder and admin diff can show WHY a level/confidence is
  -- what it is (which proof/answer fed each dimension). Not used by scoring.
  provenance     jsonb NOT NULL DEFAULT '{}'::jsonb,
  builder_version integer NOT NULL DEFAULT 1,           -- bump when mapping/curves change
  city           text,                                  -- snapshot for COL calibration (later phase)
  built_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vv_user_vectors_built ON vv_user_vectors (built_at);
