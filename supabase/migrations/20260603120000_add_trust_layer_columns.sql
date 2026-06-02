-- Phase 1 of the trust + compatibility redesign.
-- Splits trust_score into its layers so normalization can sit on top:
--   raw_trust        — absolute CG score from proofs (pre-normalization, pre-penalty)
--   identity_score   — ID + liveness subscore (the baseline layer)
--   proof_score      — composite of the four non-identity "show-off" dimensions
--   identity_verified— ID + liveness both completed (drives the heavy penalty)
--   normalized_trust — final score after population normalization + identity penalty;
--                      this is mirrored into the existing trust_score column, which
--                      every UI surface + Discover ordering already reads.
-- trust_score itself is unchanged in type/meaning to the UI — it now simply holds
-- normalized_trust. The new columns are additive and nullable; nothing breaks if
-- the backfill hasn't run yet.

ALTER TABLE verified_vibe_users
  ADD COLUMN IF NOT EXISTS raw_trust         INTEGER,
  ADD COLUMN IF NOT EXISTS identity_score    INTEGER,
  ADD COLUMN IF NOT EXISTS proof_score       INTEGER,
  ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS normalized_trust  INTEGER,
  ADD COLUMN IF NOT EXISTS trust_updated_at  TIMESTAMPTZ;
