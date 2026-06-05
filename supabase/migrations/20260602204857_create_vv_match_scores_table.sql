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
CREATE INDEX IF NOT EXISTS idx_vms_female ON vv_match_scores (female_user_id);;
