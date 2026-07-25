/**
 * Beta invite redemption (testing-period feature).
 *
 * A woman shares her referral link; people submit their email on /beta/{token},
 * which creates a `verified_vibe_beta_signups` row. When such a person finishes
 * onboarding AND is enrolled in the matchmaker pool as a man, we instantly
 * create a mutual match with the referring woman.
 *
 * redeemBetaInviteIfEligible() is called from enrollInPoolIfVerified() — i.e.
 * exactly at the moment a verified man lands in vv_pool_profiles. It is
 * idempotent and non-fatal: any failure is swallowed by the caller so it can
 * never block pool enrollment or verification.
 *
 * Since 2026-07-25 it ALSO awards the referring woman 25 INR per verified man
 * (cap 1000) — see insertRewardRow and the `track` column. The man is never told
 * money changed hands; his framing stays "earn your way to her".
 *
 * Rules (per product decisions):
 *   - Only fires for men (women also enroll in the pool, as bestie — skipped).
 *   - Only fires once the man is actually in the pool (guaranteed by the call
 *     site: enrollInPoolIfVerified only reaches us after refreshPoolEntry).
 *   - First invite wins: the earliest pending signup for the email is redeemed;
 *     any other pending invites for the same email are left untouched.
 */

import { getSupabase } from './supabase';
import { sendMatchNotification } from './matchmaker-service';

/**
 * Cash reward rules per track. The two tracks are counted SEPARATELY — see the
 * `track` column in migration 20260725143000. Mixing them would let a man
 * referral push her women-tier to 150 INR and consume her 100-invite cap.
 *
 *   woman — women invite women: #1-25 = 100 INR, #26-100 = 150 INR, cap 100
 *   man   — women invite men:   flat 25 INR, cap 1000
 *
 * Payout is MANUAL everywhere: these write what is OWED; a human pays via
 * UPI/bank and marks it paid in /admin/referral-payouts.
 */
const WOMAN_TRACK_CAP = 100;
const MAN_TRACK_RATE = 25;
const MAN_TRACK_CAP = 1000;

/** The rate the referrer's NEXT referral on each track earns. */
export function womanTrackRate(priorCount: number): number {
  return priorCount < 25 ? 100 : 150;
}
export const MAN_TRACK = { rate: MAN_TRACK_RATE, cap: MAN_TRACK_CAP };

/**
 * Write one ledger row, with the index/rate/cap computed within the given track.
 *
 * Returns false only for a real failure. A duplicate (already rewarded) counts as
 * success — the whole path is idempotent via UNIQUE(referred_user_id).
 *
 * `track` is omitted from the woman-track insert on purpose so that this keeps
 * working if the code is deployed before migration 20260725143000 runs (the
 * column default supplies 'woman' afterwards). The man track cannot do that —
 * without the column its rows would be miscounted as women referrals — so it
 * fails loudly instead.
 */
async function insertRewardRow(
  db: any,
  opts: {
    referrerId: string;
    referredUserId: string;
    signupId: string | null;
    track: 'woman' | 'man';
    mood?: string | null;
  }
): Promise<boolean> {
  const { referrerId, referredUserId, signupId, track, mood } = opts;

  // How many rewards this referrer already holds ON THIS TRACK. Void rows are
  // excluded, so a capped referral never consumes a paying slot.
  const countOnTrack = (scoped: boolean) => {
    const q = db
      .from('vv_referral_rewards')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', referrerId)
      .neq('status', 'void');
    return scoped ? q.eq('track', track) : q;
  };

  let { count: priorCount, error: countError } = await countOnTrack(true);
  if (countError && `${countError.code}` === '42703') {
    // Pre-migration: the column doesn't exist yet, so every existing row is a
    // woman referral. The unscoped count is therefore correct for that track.
    if (track === 'woman') {
      ({ count: priorCount, error: countError } = await countOnTrack(false));
    } else {
      console.error(
        '[referral-reward] vv_referral_rewards.track is missing — run migration ' +
          '20260725143000_referral_rewards_man_track.sql. Men-flow reward NOT recorded.'
      );
      return false;
    }
  }
  if (countError) {
    console.error(`[referral-reward] ${track}-track count failed (non-fatal):`, countError);
    return false;
  }

  const prior = priorCount ?? 0;
  const rewardIndex = prior + 1;
  const cap = track === 'man' ? MAN_TRACK_CAP : WOMAN_TRACK_CAP;
  const capped = rewardIndex > cap;
  const rate = capped ? 0 : track === 'man' ? MAN_TRACK_RATE : womanTrackRate(prior);

  const row: Record<string, unknown> = {
    referrer_id: referrerId,
    referred_user_id: referredUserId,
    signup_id: signupId,
    amount_inr: rate,
    tier_rate: rate,
    reward_index: rewardIndex,
    status: capped ? 'void' : 'payable',
    mood: mood ?? null,
  };
  if (track === 'man') row.track = 'man';

  const { error } = await db.from('vv_referral_rewards').insert(row);
  if (!error) return true;

  // Unique-violation on referred_user_id → already rewarded (idempotent no-op).
  const dup = `${error.code}` === '23505' || /duplicate|unique/i.test(`${error.message ?? ''}`);
  if (dup) return true;

  if (`${error.code}` === '42703') {
    console.error(
      '[referral-reward] vv_referral_rewards.track is missing — run migration ' +
        '20260725143000_referral_rewards_man_track.sql. The men-flow reward was NOT recorded.'
    );
  } else {
    console.error(`[referral-reward] ${track}-track insert failed (non-fatal):`, error);
  }
  return false;
}

export async function redeemBetaInviteIfEligible(userId: string): Promise<void> {
  const db = getSupabase() as any;

  // Must be a man — women also enroll in the pool (as bestie); skip them.
  const { data: profile } = await db
    .from('verified_vibe_users')
    .select('id, gender')
    .eq('id', userId)
    .maybeSingle();
  if (!profile || profile.gender !== 'man') return;

  // Resolve the man's email from the auth record (verified_vibe_users has none).
  const { data: authUser } = await db.auth.admin.getUserById(userId);
  const email = authUser?.user?.email?.trim().toLowerCase();
  if (!email) return;

  // Earliest pending invite for this email — first invite wins.
  const { data: signup } = await db
    .from('verified_vibe_beta_signups')
    .select('id, referrer_id, status')
    .eq('email', email) // stored normalized on insert
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!signup) return;

  const referrerId = signup.referrer_id as string;
  if (!referrerId || referrerId === userId) return;

  // Flow 1 cash (added 2026-07-25): a WOMAN earns 25 INR for every man she
  // brings who reaches this point — i.e. verified and in the pool, the same bar
  // the women flow uses. Awarded BEFORE the match work below so that a failed
  // match can never cost her the reward, and scoped to women referrers so this
  // does not quietly ship the still-deferred men→men flow.
  //
  // The man himself is never told there was money: his framing stays "earn your
  // way to her" (see the /beta landing copy).
  try {
    const { data: referrer } = await db
      .from('verified_vibe_users')
      .select('gender')
      .eq('id', referrerId)
      .maybeSingle();
    if (referrer?.gender === 'woman') {
      await insertRewardRow(db, {
        referrerId,
        referredUserId: userId,
        signupId: signup.id ?? null,
        track: 'man',
      });
    }
  } catch (e) {
    console.error('[beta-invite] man-track reward failed (non-fatal):', e);
  }

  // Don't duplicate an existing match in either orientation.
  const { data: existing } = await db
    .from('verified_vibe_matches')
    .select('id')
    .or(
      `and(user1_id.eq.${userId},user2_id.eq.${referrerId}),and(user1_id.eq.${referrerId},user2_id.eq.${userId})`
    )
    .maybeSingle();

  let matchId = existing?.id as string | undefined;

  if (!matchId) {
    // Convention (see matchmaker-service): user1 = man, user2 = woman.
    const { data: created, error } = await db
      .from('verified_vibe_matches')
      .insert({
        user1_id: userId,
        user2_id: referrerId,
        status: 'mutual',
        source: 'beta_invite',
        ai_bestie_active: true,
      })
      .select('id')
      .single();
    if (error || !created) {
      console.error('[beta-invite] Failed to create match (non-fatal):', error);
      return;
    }
    matchId = created.id;

    await Promise.allSettled([
      sendMatchNotification(userId, referrerId),
      sendMatchNotification(referrerId, userId),
    ]);

    // Bestie speaks first, same as a matchmaker-formed match (non-fatal).
    try {
      const { generateAndSendBestieOpener } = await import('./bestie-responder');
      await generateAndSendBestieOpener(created.id);
    } catch (e) {
      console.error('[beta-invite] Bestie opener failed (non-fatal):', e);
    }
  }

  // Mark the invite redeemed. Scoped to this signup id, so other people's
  // pending invites are never affected.
  await db
    .from('verified_vibe_beta_signups')
    .update({
      status: 'matched',
      matched_user_id: userId,
      matched_at: new Date().toISOString(),
    })
    .eq('id', signup.id);
}

/**
 * Refer & Earn Flow 2 (women invite women): award a CASH referral reward when an
 * invited WOMAN completes verification and enters the pool. Sibling to
 * redeemBetaInviteIfEligible, which handles the men flow — forming the match AND,
 * since 2026-07-25, paying that flow's own 25 INR on the 'man' track.
 *
 * Called from enrollInPoolIfVerified alongside the men redeem. Idempotent
 * (UNIQUE(referred_user_id) on vv_referral_rewards) and non-fatal — it must
 * never block verification.
 *
 * Tiers PER REFERRER: verified referral #1-25 = 100 INR, #26-100 = 150 INR,
 * hard cap at 100 (a referral past the cap is recorded as a 0 INR 'void' audit
 * row). Payout is MANUAL: this only writes the owed amount to the ledger; a
 * human pays via UPI/bank and marks it paid in /admin/referral-payouts.
 */
export async function awardReferralRewardIfEligible(userId: string): Promise<void> {
  const db = getSupabase() as any;

  // This is the WOMAN-track award only (an invited woman verifying). An invited
  // man is paid for on the 'man' track inside redeemBetaInviteIfEligible above.
  const { data: profile } = await db
    .from('verified_vibe_users')
    .select('id, gender')
    .eq('id', userId)
    .maybeSingle();
  if (!profile || profile.gender !== 'woman') return;

  // Resolve her email from the auth record (verified_vibe_users has none).
  const { data: authUser } = await db.auth.admin.getUserById(userId);
  const email = authUser?.user?.email?.trim().toLowerCase();
  if (!email) return;

  // Earliest pending invite for this email — first invite wins.
  const { data: signup } = await db
    .from('verified_vibe_beta_signups')
    .select('id, referrer_id, status, mood')
    .eq('email', email)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!signup) return;

  const referrerId = signup.referrer_id as string;
  if (!referrerId || referrerId === userId) return;

  // Tier/cap are computed within the woman track (#1-25 = 100, #26-100 = 150,
  // cap 100). A duplicate is treated as success — the signup was already closed
  // on the first pass — and any real failure gives up quietly, because a missed
  // reward must never fail verification.
  const awarded = await insertRewardRow(db, {
    referrerId,
    referredUserId: userId,
    signupId: signup.id ?? null,
    track: 'woman',
    mood: signup.mood ?? null,
  });
  if (!awarded) return;

  // Men-invite-women upside: if the referrer is a MAN, auto-match the invited
  // woman to him (his incentive to promote). She can unmatch if not interested,
  // and her Bestie screens him first, same as any match. Not surfaced to her as
  // "he referred you". Non-fatal — a failed match must not undo the reward.
  try {
    const { data: refProfile } = await db
      .from('verified_vibe_users')
      .select('gender')
      .eq('id', referrerId)
      .maybeSingle();
    if (refProfile?.gender === 'man') {
      const { data: existingMatch } = await db
        .from('verified_vibe_matches')
        .select('id')
        .or(
          `and(user1_id.eq.${referrerId},user2_id.eq.${userId}),and(user1_id.eq.${userId},user2_id.eq.${referrerId})`
        )
        .maybeSingle();
      if (!existingMatch) {
        // Convention (matchmaker-service): user1 = man, user2 = woman.
        const { data: created } = await db
          .from('verified_vibe_matches')
          .insert({
            user1_id: referrerId,
            user2_id: userId,
            status: 'mutual',
            source: 'beta_invite',
            ai_bestie_active: true,
          })
          .select('id')
          .single();
        if (created) {
          await Promise.allSettled([
            sendMatchNotification(referrerId, userId),
            sendMatchNotification(userId, referrerId),
          ]);
          try {
            const { generateAndSendBestieOpener } = await import('./bestie-responder');
            await generateAndSendBestieOpener(created.id);
          } catch (e) {
            console.error('[referral-match] Bestie opener failed (non-fatal):', e);
          }
        }
      }
    }
  } catch (e) {
    console.error('[referral-match] auto-match failed (non-fatal):', e);
  }

  // Close out the signup so it is not reprocessed.
  await db
    .from('verified_vibe_beta_signups')
    .update({
      status: 'rewarded',
      matched_user_id: userId,
      matched_at: new Date().toISOString(),
    })
    .eq('id', signup.id);
}
