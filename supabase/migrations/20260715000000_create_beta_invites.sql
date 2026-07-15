-- Testing-period beta referral links + collected signups (2026-07-15).
--
-- A female user gets ONE shareable link (verified_vibe_referral_links, unique
-- per referrer). Anyone who opens /beta/{token} and submits their email creates
-- a verified_vibe_beta_signups row (auto-collected, no approval step). When that
-- email later finishes onboarding AND enters the matchmaker pool as a man, the
-- server instantly creates a mutual match with the referring woman (first
-- invite wins). See src/lib/server/beta-invite.ts.
--
-- Both tables are service-role only — all reads/writes go through server
-- endpoints, so no RLS policies are defined (RLS enabled + zero policies =
-- deny-all to anon/authenticated clients; the service key bypasses RLS).

create table if not exists verified_vibe_referral_links (
  id          uuid primary key default gen_random_uuid(),
  referrer_id uuid not null unique references verified_vibe_users(id) on delete cascade,
  token       text not null unique,
  active      boolean not null default true,
  created_by  text,
  created_at  timestamptz not null default now()
);

create table if not exists verified_vibe_beta_signups (
  id              uuid primary key default gen_random_uuid(),
  link_id         uuid not null references verified_vibe_referral_links(id) on delete cascade,
  referrer_id     uuid not null references verified_vibe_users(id) on delete cascade,
  email           text not null,
  status          text not null default 'pending' check (status in ('pending', 'matched')),
  matched_user_id uuid references verified_vibe_users(id) on delete set null,
  matched_at      timestamptz,
  created_at      timestamptz not null default now()
);

-- One signup per email address (first invite wins). Emails are stored already
-- normalized (trim + lowercase); the lower() index is belt-and-suspenders.
create unique index if not exists verified_vibe_beta_signups_email_key
  on verified_vibe_beta_signups (lower(email));

create index if not exists verified_vibe_beta_signups_referrer_idx
  on verified_vibe_beta_signups (referrer_id);

create index if not exists verified_vibe_beta_signups_status_idx
  on verified_vibe_beta_signups (status);

alter table verified_vibe_referral_links enable row level security;
alter table verified_vibe_beta_signups  enable row level security;

comment on table verified_vibe_referral_links is
  'Testing-period: one shareable beta-invite link per female user. /beta/{token}.';
comment on table verified_vibe_beta_signups is
  'Testing-period: emails collected via a referral link. On the mans pool enrollment, the earliest pending row is redeemed into a mutual match with the referrer.';
