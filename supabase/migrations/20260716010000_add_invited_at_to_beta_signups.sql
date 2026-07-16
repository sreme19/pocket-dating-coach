-- Track when the human admin sent the early-access invite email (2026-07-16).
--
-- Set by POST /admin/beta/invite when an admin, having manually added the
-- person as an iOS/Android tester, sends them the "you're accepted" email with
-- the store link. Nullable: null = invite not sent yet.

alter table verified_vibe_beta_signups
  add column if not exists invited_at timestamptz;

comment on column verified_vibe_beta_signups.invited_at is
  'When the early-access invite email (with the store link) was sent from the Beta Invites admin. Null = not sent yet.';
