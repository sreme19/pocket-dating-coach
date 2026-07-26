/**
 * GET /api/verified-vibe/referral-link
 *
 * Self-serve referral links for the Refer & Earn feature. Returns the logged-in
 * member's own /beta/{token} share links, creating them on first call, plus the
 * funnel counts for the status lines.
 *
 * This is the self-serve counterpart to POST /admin/beta/link (admin-issued):
 * same table (verified_vibe_referral_links) and the same 12-char base64url
 * token, so a link behaves identically however it was created.
 *
 * Auth: Bearer token (the caller only ever gets their OWN links).
 *
 * Response: { token, path, gender, invited, signedUp, cash, menCash, private }
 *   invited  = everyone who submitted their email via her PUBLIC link
 *   signedUp = those who then joined and were auto-matched to her (status 'matched')
 *   cash     = the WOMEN track (invite women): 100 INR for #1-25, then 150, cap 100
 *   menCash  = the MEN track (invite men): flat 25 INR, cap 1000
 *   private  = the private link { token, path, invited, signedUp } — a second
 *              token whose landing shows nothing about the referrer and which
 *              never forms a match. null when migration 20260726170526 hasn't
 *              run yet (the client then hides the Privately tab).
 *
 * The two cash tracks are summed independently — their rates and caps are
 * per track, so one shared total would misreport both. Private referrals are NOT
 * a third track: they pay into whichever track the joiner's gender implies, so
 * their earnings are already inside `cash` / `menCash`.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { randomBytes } from 'node:crypto';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { getSupabase } from '$lib/server/supabase';
import { modeOf, selectReferralLinks, type LinkMode } from '$lib/server/referral-links';

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

  // One link per member PER MODE — reuse the existing tokens, or mint on first
  // call. `hasMode` is false until migration 20260726170526 runs; a private link
  // is not representable then, so we must not try to create one.
  const owned = await selectReferralLinks(db, 'id, token', (q) => q.eq('referrer_id', userId));
  const hasMode = owned.hasMode;
  let rows = owned.rows;
  const find = (mode: LinkMode) => rows.find((r) => modeOf(r) === mode);

  async function ensureLink(mode: LinkMode): Promise<{ id: string; token: string } | null> {
    const existing = find(mode);
    if (existing) return existing as { id: string; token: string };
    if (mode === 'private' && !hasMode) return null;

    const token = randomBytes(9).toString('base64url'); // 12-char url-safe slug
    const row: Record<string, unknown> = { referrer_id: userId, token, created_by: 'self' };
    // Omitted pre-migration so the insert still satisfies the old schema; the
    // column default supplies 'public' afterwards.
    if (hasMode) row.mode = mode;

    const { data: created, error } = await db
      .from('verified_vibe_referral_links')
      .insert(row)
      .select('id, token')
      .single();
    if (!error && created) {
      rows = [...rows, { ...created, mode }];
      return created as { id: string; token: string };
    }

    // Likely a unique-violation race (link created concurrently) — re-read.
    const again = await selectReferralLinks(db, 'id, token', (q) => q.eq('referrer_id', userId));
    rows = again.rows;
    return (find(mode) as { id: string; token: string } | undefined) ?? null;
  }

  const publicLink = await ensureLink('public');
  if (!publicLink?.token) return json({ error: 'Failed to create link' }, { status: 500 });
  const privateLink = await ensureLink('private');
  const token = publicLink.token;

  // Funnel counts + cash ledger rows (both tracks), one round-trip.
  //
  // Counts are scoped by link_id, not referrer_id, so the public tab's status
  // line stays about the public link once a private one exists. Every signup row
  // carries a link_id (NOT NULL), so this is equivalent for existing data.
  const countSignups = (linkId: string | undefined, statuses?: string[]) => {
    if (!linkId) return Promise.resolve({ count: 0 });
    let q = db
      .from('verified_vibe_beta_signups')
      .select('id', { count: 'exact', head: true })
      .eq('link_id', linkId);
    if (statuses) q = statuses.length === 1 ? q.eq('status', statuses[0]) : q.in('status', statuses);
    return q;
  };

  const [invitedRes, signedUpRes, rewardsRes, pInvitedRes, pJoinedRes] = await Promise.all([
    countSignups(publicLink.id),
    countSignups(publicLink.id, ['matched']),
    db.from('vv_referral_rewards').select('amount_inr, status, track').eq('referrer_id', userId),
    countSignups(privateLink?.id),
    // A private link never forms a match, so its joiners close as 'rewarded'
    // (or 'matched' on the no-cash men->men path) — both count as "joined".
    countSignups(privateLink?.id, ['matched', 'rewarded']),
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
    // The private link — same attribution and cash as the public one, but the
    // landing shows nothing about the referrer and no match is ever formed.
    // null pre-migration, which is the client's cue to hide the tab.
    private: privateLink?.token
      ? {
          token: privateLink.token,
          path: `/beta/${privateLink.token}`,
          invited: pInvitedRes.count ?? 0,
          signedUp: pJoinedRes.count ?? 0,
        }
      : null,
  });
};
