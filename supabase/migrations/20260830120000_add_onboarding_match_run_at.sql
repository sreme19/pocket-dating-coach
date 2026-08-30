-- Onboarding bootstrap matcher: fire the seeding run at most once per user, the
-- first time they land on their profile page after onboarding. This timestamp is
-- the idempotency key — set once the run has executed for an eligible user so
-- repeat profile visits never re-trigger it (and never re-spend Claude scoring).
alter table verified_vibe_users
  add column if not exists onboarding_match_run_at timestamptz;

comment on column verified_vibe_users.onboarding_match_run_at is
  'When the one-time onboarding matchmaker seeding run executed for this user. NULL = not yet run.';
