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
