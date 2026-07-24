-- Refer & Earn Flow 2 (women invite women) — CASH referral ledger + signup mood.
-- Manual payout: this table only tracks what is OWED; a human pays via UPI/bank
-- and marks it paid. No automated money movement anywhere.
--
-- Reward tiers PER REFERRER: verified referrals #1-25 = 100 INR each,
-- #26-100 = 150 INR each, hard cap at 100 (max ~= 13,750 INR / referrer).
-- Payout is earned only when the invited WOMAN completes verification
-- (liveness + photos = pool-eligible), never on mere signup.
--
-- Service-role only, like verified_vibe_referral_links / verified_vibe_beta_signups.

-- (a) Mood/intent the referrer chose, carried via /beta/<token>?m=<mood> and
--     stored on the invitee's signup. STORAGE ONLY — this does not drive the
--     invitee's onboarding (the real "networking mode" is built separately and
--     consumes this value; this migration must not couple to it).
alter table verified_vibe_beta_signups
  add column if not exists mood text
    check (mood is null or mood in ('networking', 'casual', 'serious'));

-- Widen the signup status so the women-flow terminal state 'rewarded' is legal
-- alongside the men-flow 'matched'. (Was: check (status in ('pending','matched')).)
alter table verified_vibe_beta_signups
  drop constraint if exists verified_vibe_beta_signups_status_check;
alter table verified_vibe_beta_signups
  add constraint verified_vibe_beta_signups_status_check
    check (status in ('pending', 'matched', 'rewarded'));

-- (b) The cash payout ledger. One row per rewarded (verified) referred woman.
create table if not exists vv_referral_rewards (
  id                uuid primary key default gen_random_uuid(),
  referrer_id       uuid not null references verified_vibe_users(id) on delete cascade,
  referred_user_id  uuid not null unique references verified_vibe_users(id) on delete cascade,
  signup_id         uuid references verified_vibe_beta_signups(id) on delete set null,
  amount_inr        integer not null,
  tier_rate         integer not null,          -- 100 or 150
  reward_index      integer not null,          -- the referrer's Nth verified referral (1..100)
  status            text not null default 'payable'
                      check (status in ('payable', 'paid', 'void')),
  mood              text,                        -- snapshot of the signup mood at award time
  device_hash       text,                        -- nullable; reserved for future device dedup
  created_at        timestamptz not null default now(),
  payable_at        timestamptz not null default now(),
  paid_at           timestamptz,
  paid_by           text,
  payout_ref        text
);

create index if not exists vv_referral_rewards_referrer_idx
  on vv_referral_rewards (referrer_id);
create index if not exists vv_referral_rewards_status_idx
  on vv_referral_rewards (status);

alter table vv_referral_rewards enable row level security;

drop policy if exists "service_role_all_vv_referral_rewards" on vv_referral_rewards;
create policy "service_role_all_vv_referral_rewards"
  on vv_referral_rewards for all to service_role using (true) with check (true);

comment on table vv_referral_rewards is
  'Refer & Earn Flow 2 manual cash-payout ledger. One row per verified woman referral. Tiers: #1-25 = 100 INR, #26-100 = 150 INR, cap 100. UNIQUE(referred_user_id) enforces idempotency + cap. Admin marks paid; no automated transfer.';
