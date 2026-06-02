-- ============================================================
-- Test Suite logging — isolated from the production QA Queue.
--
-- These tables are read/written ONLY by the admin Test Suite
-- (/admin/test-suite). Nothing here ever flows into ai_qa_reviews or the
-- production QA queue. See AI_TEST_SUITE_DESIGN.md §7.5.
--
-- Apply via the Supabase SQL editor (no exec_sql available in this project).
-- ============================================================

-- One row per Test Suite run (Case 1 / 2 / 3), holding the full AgentTrace.
create table if not exists ts_runs (
  id                  uuid primary key default gen_random_uuid(),
  case_type           text not null,        -- 'advisor' | 'match_reply' | 'matchmaker'
  agent               text not null,        -- 'bestie_advisor' | 'wingman_advisor' | 'bestie_match_reply' | 'matchmaker'
  subject_user_id     uuid,
  counterpart_user_id uuid,
  reviewer            text,                 -- pdc_reviewer cookie, for attribution
  input               jsonb not null,       -- operator message/params + history
  output              jsonb not null,       -- reply / score result
  trace               jsonb not null,       -- the full AgentTrace
  created_at          timestamptz default now()
);

create index if not exists ts_runs_created_idx on ts_runs (created_at desc);
create index if not exists ts_runs_agent_idx   on ts_runs (agent);

-- Cached pairwise Matchmaker scores so repeated runs don't re-call Claude.
-- Keyed by both user ids AND both profile versions, so a profile change
-- invalidates only the affected pairs. See AI_TEST_SUITE_DESIGN.md §6 (Case 3).
create table if not exists ts_pair_scores (
  male_user_id           uuid not null,
  female_user_id         uuid not null,
  male_profile_version   int,
  female_profile_version int,
  hard_filter            jsonb not null,    -- { excluded, reasons }
  soft_score             jsonb not null,    -- { score, rationale, flags }
  scored_at              timestamptz default now(),
  primary key (male_user_id, female_user_id, male_profile_version, female_profile_version)
);
