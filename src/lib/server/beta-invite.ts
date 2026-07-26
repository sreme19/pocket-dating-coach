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
 * WHICH FLOW A SIGNUP BELONGS TO IS DECIDED BY THE JOINER'S GENDER, never by the
 * link. There is only one referral link per referrer — the "invite women" and
 * "invite men" variants are the same token, differing only by the ?m=<mood> copy
 * — and a signup row stores no gender, because at invite time nobody knows it.
 * So all four combinations resolve here and in awardReferralRewardIfEligible:
 *
 *   woman's link → man joins    → men flow:   25 INR (man track)  + match
 *   woman's link → woman joins  → women flow: 100/150 (woman track), NO match
 *   man's link   → woman joins  → women flow: 100/150 (woman track) + match to him
 *   man's link   → man joins    → attribution only: no cash (men→men is
 *                                 deferred) and NO match (same gender)
 *
 * A match is only ever formed across genders; a same-gender referral still signs
 * up and is still attributed to the referrer.
 *
 * PRIVATE LINKS (mode='private', migration 20260726170526) cut across all four
 * rows above: the cash and the attribution are identical, but NO match is ever
 * formed, in either direction. That is the deal the sender was shown — their
 * profile never travelled with the link, so they cannot be handed the joiner (or
 * vice versa) on the strength of it. Privacy is read from the LINK, not the
 * signup row, so it cannot drift from what the invitee actually opened.
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
import { signupLinkMode } from './referral-links';

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
    .select('id, referrer_id, status, link_id')
    .eq('email', email) // stored normalized on insert
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!signup) return;

  const referrerId = signup.referrer_id as string;
  if (!referrerId || referrerId === userId) return;

  // There is only ONE link per referrer — the "invite women" and "invite men"
  // variants are the same token, differing only by the ?m=<mood> copy — and the
  // signup captures no gender (nobody knows it at invite time). So the flow is
  // decided HERE, by the joiner's real gender: a man landing on this function is
  // the men flow whichever variant he was sent, and a woman is handled by
  // awardReferralRewardIfEligible instead.
  const { data: referrer } = await db
    .from('verified_vibe_users')
    .select('gender')
    .eq('id', referrerId)
    .maybeSingle();
  const referrerIsWoman = referrer?.gender === 'woman';

  // Did he arrive on her PRIVATE link? Then she gets the cash and the
  // attribution, and no match is formed (see the header note).
  const isPrivate = (await signupLinkMode(db, signup.link_id)) === 'private';

  // Flow 1 cash (added 2026-07-25): a WOMAN earns 25 INR for every man she
  // brings who reaches this point — i.e. verified and in the pool, the same bar
  // the women flow uses. Awarded BEFORE the match work below so that a failed
  // match can never cost her the reward, and scoped to women referrers so this
  // does not quietly ship the still-deferred men→men flow.
  //
  // The man himself is never told there was money: his framing stays "earn your
  // way to her" (see the /beta landing copy).
  if (referrerIsWoman) {
    try {
      await insertRewardRow(db, {
        referrerId,
        referredUserId: userId,
        signupId: signup.id ?? null,
        track: 'man',
      });
    } catch (e) {
      console.error('[beta-invite] man-track reward failed (non-fatal):', e);
    }
  }

  // A referral only forms a match across genders. A man arriving on another
  // MAN's link still signs up and is still attributed to him, but no match is
  // created — men→men is a deferred flow, and this used to mint a man↔man match
  // because the guard only checked the joiner's gender. Mirrors the woman↔woman
  // rule in awardReferralRewardIfEligible.
  //
  // A private link stops here too, for the opposite reason: the pairing would be
  // legal, but she shared a link that carried nothing about her precisely so it
  // wouldn't put strangers in her matches. Closed as 'rewarded' when she was
  // paid, so the funnel doesn't claim a match that was never made.
  if (!referrerIsWoman || isPrivate) {
    await closeSignup(db, signup.id, userId, isPrivate && referrerIsWoman ? 'rewarded' : 'matched');
    return;
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

  await closeSignup(db, signup.id, userId);
}

/**
 * Mark an invite redeemed. Scoped to the one signup id, so other people's pending
 * invites for the same email are never affected.
 *
 * `status` distinguishes the flows for the funnel counts: 'matched' = a man
 * joined (men flow), 'rewarded' = a woman joined (women flow).
 */
async function closeSignup(
  db: any,
  signupId: string,
  userId: string,
  status: 'matched' | 'rewarded' = 'matched'
): Promise<void> {
  await db
    .from('verified_vibe_beta_signups')
    .update({
      status,
      matched_user_id: userId,
      matched_at: new Date().toISOString(),
    })
    .eq('id', signupId);
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
    .select('id, referrer_id, status, mood, link_id')
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
  //
  // A WOMAN referrer gets the cash and the attribution but no match: two women
  // are never matched to each other. Same cross-gender rule as the men flow.
  //
  // A PRIVATE link also gets the cash and the attribution and no match — even
  // man→woman, where a match is his usual upside. He chose the link that shows
  // her nothing about him; it cannot then drop him into her matches.
  try {
    const isPrivate = (await signupLinkMode(db, signup.link_id)) === 'private';
    const { data: refProfile } = await db
      .from('verified_vibe_users')
      .select('gender')
      .eq('id', referrerId)
      .maybeSingle();
    if (refProfile?.gender === 'man' && !isPrivate) {
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
  await closeSignup(db, signup.id, userId, 'rewarded');
}
