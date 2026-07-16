-- Add device platform (ios/android) to beta signups (2026-07-16).
--
-- Collected on the /beta/{token} landing form alongside the email, and shown
-- in the Beta Invites admin table. Nullable + no default: rows collected
-- before this column existed stay null (shown as "—" in admin).

alter table verified_vibe_beta_signups
  add column if not exists platform text check (platform in ('ios', 'android'));

comment on column verified_vibe_beta_signups.platform is
  'Device platform the beta tester picked on the /beta/{token} form: ios | android. Null for signups collected before this column existed.';
