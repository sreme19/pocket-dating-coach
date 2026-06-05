-- Test Suite logging — isolated from the production QA Queue.
-- Read/written ONLY by /admin/test-suite. Never flows into ai_qa_reviews.

create table if not exists ts_runs (
  id                  uuid primary key default gen_random_uuid(),
  case_type           text not null,
  agent               text not null,
  subject_user_id     uuid,
  counterpart_user_id uuid,
  reviewer            text,
  input               jsonb not null,
  output              jsonb not null,
  trace               jsonb not null,
  created_at          timestamptz default now()
);

create index if not exists ts_runs_created_idx on ts_runs (created_at desc);
create index if not exists ts_runs_agent_idx   on ts_runs (agent);

create table if not exists ts_pair_scores (
  male_user_id           uuid not null,
  female_user_id         uuid not null,
  male_profile_version   int,
  female_profile_version int,
  hard_filter            jsonb not null,
  soft_score             jsonb not null,
  scored_at              timestamptz default now(),
  primary key (male_user_id, female_user_id, male_profile_version, female_profile_version)
);;
