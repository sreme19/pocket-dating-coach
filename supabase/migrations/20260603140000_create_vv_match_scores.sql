-- Phase 2 of the trust + compatibility redesign.
-- Persists the two-sided compatibility + competitive Standing for each matched
-- pair, precomputed by the Matchmaker so the Wingman/Bestie can read it
-- synchronously (no per-turn LLM scoring). One row per (male, female) pair.
--
--   appeal_to_her / appeal_to_him  — directional fit (his profile vs her prefs,
--                                    and her profile vs his prefs), 0–100
--   his_composite / her_composite  — 0.7*appeal + 0.3*normalized_trust
--   *_standing_rank / *_standing_pool — rank among the OTHER side's mutual matches
--   *_checklist  — approach advice to raise appeal (never dumps her preferences)
--   *_simulation — what-if: action → trust/percentile/standing deltas
--   rationale    — short model explanation (not surfaced raw to users)

CREATE TABLE IF NOT EXISTS vv_match_scores (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  male_user_id      uuid NOT NULL,
  female_user_id    uuid NOT NULL,
  match_id          uuid,
  appeal_to_her     integer,
  appeal_to_him     integer,
  his_composite     integer,
  her_composite     integer,
  his_standing_rank integer,
  his_standing_pool integer,
  her_standing_rank integer,
  her_standing_pool integer,
  his_checklist     jsonb,
  her_checklist     jsonb,
  his_simulation    jsonb,
  her_simulation    jsonb,
  rationale         text,
  computed_at       timestamptz DEFAULT now(),
  UNIQUE (male_user_id, female_user_id)
);

CREATE INDEX IF NOT EXISTS idx_vms_male   ON vv_match_scores (male_user_id);
CREATE INDEX IF NOT EXISTS idx_vms_female ON vv_match_scores (female_user_id);
