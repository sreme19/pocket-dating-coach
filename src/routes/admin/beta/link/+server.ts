/**
 * POST /admin/beta/link
 *   Generate (or fetch the existing) beta-invite share link for a female user.
 *   Triggered from the Beta Invites admin tab.
 *
 *   Body (JSON): { referrerId: string }   // a verified_vibe_users id, gender=woman
 *   Returns:     { token, path }          // path = /beta/{token}
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

export const POST: RequestHandler = async ({ request, cookies }) => {
  if (!tokenIsValid(cookies.get(ADMIN_COOKIE))) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  let referrerId: unknown;
  try {
    ({ referrerId } = await request.json());
  } catch {
    return json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (typeof referrerId !== 'string' || !referrerId) {
    return json({ error: 'referrerId is required' }, { status: 400 });
  }

  const db = getSupabase() as any;

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

  // One link per female — return the existing token if there is one.
  const { data: existing } = await db
    .from('verified_vibe_referral_links')
    .select('token')
    .eq('referrer_id', referrerId)
    .maybeSingle();

  let token = existing?.token as string | undefined;

  if (!token) {
    token = randomBytes(9).toString('base64url'); // 12-char url-safe slug
    const { error } = await db
      .from('verified_vibe_referral_links')
      .insert({
        referrer_id: referrerId,
        token,
        created_by: cookies.get(REVIEWER_COOKIE) ?? null,
      });

    if (error) {
      // Likely a unique-violation race (link created concurrently) — re-read.
      const { data: retry } = await db
        .from('verified_vibe_referral_links')
        .select('token')
        .eq('referrer_id', referrerId)
        .maybeSingle();
      if (!retry?.token) {
        return json({ error: 'Failed to create link' }, { status: 500 });
      }
      token = retry.token;
    }
  }

  return json({ token, path: `/beta/${token}` });
};
