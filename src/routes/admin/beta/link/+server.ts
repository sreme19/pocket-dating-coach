/**
 * POST /admin/beta/link
 *   Generate (or fetch the existing) beta-invite share link.
 *   Triggered from the Beta Invites admin tab.
 *
 *   Body (JSON), one of:
 *     { referrerId: string }  // a verified_vibe_users id, gender=woman
 *     { kind: 'admin_invite_women' | 'admin_invite_men' } // not tied to any
 *       user; shown as "Admin" in Collected emails. Singleton per kind
 *       (enforced by a partial unique index on referral_links.kind).
 *   Returns: { token, path }  // path = /beta/{token}
 *
 * Auth: admin session cookie (pdc_admin). This route lives under /admin so the
 * path-scoped admin cookie is sent; +server.ts handlers don't run the layout
 * load, so the token is validated explicitly here.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { randomBytes } from 'node:crypto';
import { getSupabase } from '$lib/server/supabase';
import { ADMIN_COOKIE, REVIEWER_COOKIE, tokenIsValid } from '$lib/server/admin-auth';
import { modeOf, selectReferralLinks } from '$lib/server/referral-links';

const ADMIN_KINDS = ['admin_invite_women', 'admin_invite_men'] as const;
type AdminKind = (typeof ADMIN_KINDS)[number];

export const POST: RequestHandler = async ({ request, cookies }) => {
  if (!tokenIsValid(cookies.get(ADMIN_COOKIE))) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  let referrerId: unknown;
  let kind: unknown;
  try {
    ({ referrerId, kind } = await request.json());
  } catch {
    return json({ error: 'Invalid request body' }, { status: 400 });
  }

  const db = getSupabase() as any;

  // Admin-level link: not tied to any user, singleton per kind.
  if (typeof kind === 'string') {
    if (!ADMIN_KINDS.includes(kind as AdminKind)) {
      return json({ error: 'Invalid kind' }, { status: 400 });
    }

    const { data: existing } = await db
      .from('verified_vibe_referral_links')
      .select('token')
      .eq('kind', kind)
      .maybeSingle();

    let adminToken = existing?.token as string | undefined;

    if (!adminToken) {
      adminToken = randomBytes(9).toString('base64url');
      const { error } = await db.from('verified_vibe_referral_links').insert({
        referrer_id: null,
        kind,
        token: adminToken,
        created_by: cookies.get(REVIEWER_COOKIE) ?? null,
      });

      if (error) {
        // Likely a unique-violation race — re-read.
        const { data: retry } = await db
          .from('verified_vibe_referral_links')
          .select('token')
          .eq('kind', kind)
          .maybeSingle();
        if (!retry?.token) {
          return json({ error: 'Failed to create link' }, { status: 500 });
        }
        adminToken = retry.token;
      }
    }

    return json({ token: adminToken, path: `/beta/${adminToken}` });
  }

  if (typeof referrerId !== 'string' || !referrerId) {
    return json({ error: 'referrerId or kind is required' }, { status: 400 });
  }

  // Must be an existing female user.
  const { data: user } = await db
    .from('verified_vibe_users')
    .select('id, gender')
    .eq('id', referrerId)
    .maybeSingle();
  if (!user) {
    return json({ error: 'User not found' }, { status: 404 });
  }
  if (user.gender !== 'woman') {
    return json({ error: 'Referral links can only be generated for female users' }, { status: 400 });
  }

  // One PUBLIC link per female — return the existing token if there is one. A
  // member may also own a private link (mode='private'); this endpoint only ever
  // issues and returns the public one, so it must select by mode rather than
  // assume a single row per referrer.
  const owned = await selectReferralLinks(db, 'token', (q) => q.eq('referrer_id', referrerId));
  const publicOf = (rows: Array<Record<string, any>>) =>
    rows.find((r) => modeOf(r) === 'public')?.token as string | undefined;

  let token = publicOf(owned.rows);

  if (!token) {
    token = randomBytes(9).toString('base64url'); // 12-char url-safe slug
    const row: Record<string, unknown> = {
      referrer_id: referrerId,
      token,
      created_by: cookies.get(REVIEWER_COOKIE) ?? null,
    };
    // Omitted pre-migration; the column default supplies 'public' afterwards.
    if (owned.hasMode) row.mode = 'public';

    const { error } = await db.from('verified_vibe_referral_links').insert(row);

    if (error) {
      // Likely a unique-violation race (link created concurrently) — re-read.
      const retry = await selectReferralLinks(db, 'token', (q) => q.eq('referrer_id', referrerId));
      const retryToken = publicOf(retry.rows);
      if (!retryToken) {
        return json({ error: 'Failed to create link' }, { status: 500 });
      }
      token = retryToken;
    }
  }

  return json({ token, path: `/beta/${token}` });
};
