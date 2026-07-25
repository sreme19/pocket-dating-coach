-- Refer & Earn Flow 1 (women invite MEN) — add a cash reward to the men flow.
--
-- Until now only the women→women flow paid (100/150 INR, cap 100). The men flow
-- paid nothing: the vetted men were the reward. Product decision 2026-07-25 adds
-- a flat 25 INR per verified MAN, cap 1000 per referrer.
--
-- The two tracks MUST be counted separately. vv_referral_rewards.reward_index and
-- the cap/tier are derived from "how many non-void rows does this referrer already
-- have" — with both flows in one table and no discriminator, a man referral would
-- push her women-tier from 100 to 150 INR and eat her 100-invite cap (and vice
-- versa). `track` is that discriminator.
--
-- Existing rows are all women referrals, so the default backfills them correctly.

alter table vv_referral_rewards
  add column if not exists track text not null default 'woman'
    check (track in ('woman', 'man'));

comment on column vv_referral_rewards.track is
  'Which flow earned this row: woman = women invite women (100/150 INR, cap 100), man = women invite men (25 INR, cap 1000). Tier, reward_index and cap are counted PER TRACK — never across both.';

-- The award path counts rows by (referrer_id, track) on every verification, so
-- index the pair rather than referrer_id alone.
create index if not exists vv_referral_rewards_referrer_track_idx
  on vv_referral_rewards (referrer_id, track);

comment on table vv_referral_rewards is
  'Refer & Earn manual cash-payout ledger, one row per verified referral. Two tracks (see track column): woman = 100 INR for #1-25 then 150 INR to a cap of 100; man = flat 25 INR to a cap of 1000. UNIQUE(referred_user_id) enforces idempotency; a referral past its track cap is recorded as a 0 INR ''void'' audit row. Admin marks paid in /admin/referral-payouts; no automated transfer.';
