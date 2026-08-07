-- Provisional members — anonymous visitors from the /aibestie ad landing page.
--
-- A visitor gets a REAL auth user, a REAL verified_vibe_users row and a REAL
-- match, so the whole existing stack (chat/send, the Bestie responder, the
-- checklist, contact scrub, PII compliance, chat-read) works on them unchanged.
-- The price of that reuse is that they are indistinguishable from members
-- everywhere else, and `is_seed = false` — the predicate that means "is a real
-- member" in 15 different queries — would be TRUE for them.
--
-- Two of those queries make that unacceptable rather than untidy:
--   · trust-normalize cohorts on is_seed = false, so ad traffic would
--     redistribute every real man's trust percentile.
--   · new-member-alert treats is_seed = false as a signup, so every ad click
--     would email chris@ within five minutes.
--
-- Hence this column, and realMembersOnly() in src/lib/server/member-state.ts as
-- the single place both filters are applied.
--
-- Reads of this column are gated on AIBESTIE_LP_GATE so the code can deploy
-- before this migration runs (migrations here are applied by hand in the SQL
-- editor). Flip the flag only once this has been applied.
alter table verified_vibe_users
  add column if not exists is_provisional boolean not null default false;

-- Provisional rows are the minority being excluded, so index only those.
create index if not exists idx_vv_users_provisional
  on verified_vibe_users (is_provisional)
  where is_provisional = true;

comment on column verified_vibe_users.is_provisional is
  'True for /aibestie ad-landing visitors who have not signed up yet. Excluded from every real-member query via realMembersOnly(). Cleared on signup; rows still true after 30 days are purged by the provisional reaper.';
