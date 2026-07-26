/**
 * GET /api/verified-vibe/referral-link
 *
 * Self-serve referral link for the Refer & Earn feature (women invite men).
 * Returns the logged-in woman's own /beta/{token} share link, creating it on
 * first call, plus her funnel counts for the status line.
 *
 * This is the self-serve counterpart to POST /admin/beta/link (admin-issued):
 * same table (verified_vibe_referral_links, one row per woman) and the same
 * 12-char base64url token, so a link behaves identically however it was created.
 *
 * Auth: Bearer token (the caller only ever gets their OWN link). Referral links
 * are for women only (they invite men) — mirrors the admin gender guard.
 *
 * Response: { token, path, gender, invited, signedUp, cash, menCash }
 *   invited  = everyone who submitted their email via her link
 *   signedUp = those who then joined and were auto-matched to her (status 'matched')
 *   cash     = the WOMEN track (invite women): 100 INR for #1-25, then 150, cap 100
 *   menCash  = the MEN track (invite men): flat 25 INR, cap 1000
 *
 * The two cash tracks are summed independently — their rates and caps are
 * per track, so one shared total would misreport both.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { randomBytes } from 'node:crypto';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { getSupabase } from '$lib/server/supabase';

async function getUserId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  try {
    const client = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await client.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export const GET: RequestHandler = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

  const db = getSupabase() as any;

  const { data: user } = await db
    .from('verified_vibe_users')
    .select('id, gender')
    .eq('id', userId)
    .maybeSingle();
  if (!user) return json({ error: 'Profile not found' }, { status: 404 });
  // Any member can refer. Women get the men (Bestie) + women (cash) flows; men
  // get the women (cash) flow, where an invited woman who verifies is auto-matched
  // to the referring man. `gender` (returned below) tailors the client UI.

  // One link per woman — reuse the existing token, or mint one on first call.
  const { data: existing } = await db
    .from('verified_vibe_referral_links')
    .select('token')
    .eq('referrer_id', userId)
    .maybeSingle();

  let token = existing?.token as string | undefined;

  if (!token) {
    token = randomBytes(9).toString('base64url'); // 12-char url-safe slug
    const { error } = await db
      .from('verified_vibe_referral_links')
      .insert({ referrer_id: userId, token, created_by: 'self' });

    if (error) {
      // Likely a unique-violation race (link created concurrently) — re-read.
      const { data: retry } = await db
        .from('verified_vibe_referral_links')
        .select('token')
        .eq('referrer_id', userId)
        .maybeSingle();
      if (!retry?.token) {
        return json({ error: 'Failed to create link' }, { status: 500 });
      }
      token = retry.token;
    }
  }

  // Funnel counts (men flow) + cash ledger rows (both tracks), one round-trip.
  const [invitedRes, signedUpRes, rewardsRes] = await Promise.all([
    db
      .from('verified_vibe_beta_signups')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', userId),
    db
      .from('verified_vibe_beta_signups')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', userId)
      .eq('status', 'matched'),
    db.from('vv_referral_rewards').select('amount_inr, status, track').eq('referrer_id', userId),
  ]);

  type RewardRow = { amount_inr: number; status: string; track?: string | null };
  let rewardRows = (rewardsRes.data ?? []) as RewardRow[];

  // Pre-migration fallback: `track` only exists after 20260725143000. Without it
  // every row is a woman referral, which is exactly what the default backfills.
  if (rewardsRes.error && `${rewardsRes.error.code}` === '42703') {
    const retry = await db
      .from('vv_referral_rewards')
      .select('amount_inr, status')
      .eq('referrer_id', userId);
    rewardRows = ((retry.data ?? []) as RewardRow[]).map((r) => ({ ...r, track: 'woman' }));
  }

  // Sum each track separately — the caps and rates are per track, so a shared
  // total would misreport both. A referrer holds <= 1100 rows, so client-side is fine.
  const summarise = (rows: RewardRow[]) => {
    const paidInr = rows
      .filter((r) => r.status === 'paid')
      .reduce((sum, r) => sum + (r.amount_inr ?? 0), 0);
    const pendingInr = rows
      .filter((r) => r.status === 'payable')
      .reduce((sum, r) => sum + (r.amount_inr ?? 0), 0);
    return {
      verifiedCount: rows.filter((r) => r.status !== 'void').length,
      earnedInr: paidInr + pendingInr,
      paidInr,
      pendingInr,
    };
  };

  // Rows written before the migration have no track and are women referrals.
  const womanRows = rewardRows.filter((r) => (r.track ?? 'woman') === 'woman');
  const manRows = rewardRows.filter((r) => r.track === 'man');
  const woman = summarise(womanRows);
  const man = summarise(manRows);

  return json({
    token,
    path: `/beta/${token}`,
    gender: user.gender ?? null,
    invited: invitedRes.count ?? 0,
    signedUp: signedUpRes.count ?? 0,
    // `cash` = the women track, unchanged shape so older app builds keep working.
    cash: {
      ...woman,
      currentTier: woman.verifiedCount < 25 ? 100 : 150, // rate her next referral earns
      cap: 100,
    },
    // `menCash` = the women-invite-MEN track: flat 25 INR, cap 1000.
    menCash: {
      ...man,
      currentTier: 25,
      cap: 1000,
    },
  });
};
