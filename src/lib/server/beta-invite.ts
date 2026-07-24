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
 * Rules (per product decisions):
 *   - Only fires for men (women also enroll in the pool, as bestie — skipped).
 *   - Only fires once the man is actually in the pool (guaranteed by the call
 *     site: enrollInPoolIfVerified only reaches us after refreshPoolEntry).
 *   - First invite wins: the earliest pending signup for the email is redeemed;
 *     any other pending invites for the same email are left untouched.
 */

import { getSupabase } from './supabase';
import { sendMatchNotification } from './matchmaker-service';

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
 * redeemBetaInviteIfEligible (which handles the men flow by forming a match).
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

  // Only women earn the referrer cash here; men go through the match flow above.
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

  // Tier from how many rewards this referrer already holds (void rows excluded,
  // so a capped referral never consumes a paying slot). #1-25 = 100, #26-100 = 150.
  const { count: priorCount } = await db
    .from('vv_referral_rewards')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_id', referrerId)
    .neq('status', 'void');

  const rewardIndex = (priorCount ?? 0) + 1;
  const capped = rewardIndex > 100;
  const tierRate = capped ? 0 : rewardIndex <= 25 ? 100 : 150;

  const { error } = await db.from('vv_referral_rewards').insert({
    referrer_id: referrerId,
    referred_user_id: userId,
    signup_id: signup.id,
    amount_inr: tierRate,
    tier_rate: tierRate,
    reward_index: rewardIndex,
    status: capped ? 'void' : 'payable',
    mood: signup.mood ?? null,
  });

  if (error) {
    // Unique-violation on referred_user_id → already rewarded (idempotent no-op);
    // the signup was already closed on the first pass. Any other error: give up
    // quietly — a missed reward must never fail verification.
    const dup = `${error.code}` === '23505' || /duplicate|unique/i.test(`${error.message ?? ''}`);
    if (!dup) console.error('[referral-reward] insert failed (non-fatal):', error);
    return;
  }

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
