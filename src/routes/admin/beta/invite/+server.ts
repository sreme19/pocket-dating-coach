/**
 * POST /admin/beta/invite
 *   Re-send the early-access invite email to a collected beta signup.
 *   Congratulates them, shows the matched woman's card when there is one
 *   (admin-link signups have no referrer — they get the same invite without the
 *   card), and links BOTH app stores.
 *
 *   Under closed testing this was the gate: nobody could install anything until
 *   an admin had added them as a tester and pressed this. Play and TestFlight are
 *   both open as of 2026-08-03, so the signup's own confirmation email already
 *   carries the same links — this endpoint is now for someone who lost that mail.
 *
 *   Body (JSON): { signupId: string }
 *   Returns:     { success: true, invited_at: string }
 *
 * Auth: admin session cookie (pdc_admin). Unlike the auto confirmation email,
 * a send failure here is surfaced to the admin (non-2xx) — they need to know
 * whether the invite actually went out.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
import { ADMIN_COOKIE, tokenIsValid } from '$lib/server/admin-auth';
import {
  sendEarlyAccessEmail,
  type Platform,
  type ReferrerCard,
} from '$lib/server/beta-invite-email';
import { signupLinkMode } from '$lib/server/referral-links';

export const POST: RequestHandler = async ({ request, cookies }) => {
  if (!tokenIsValid(cookies.get(ADMIN_COOKIE))) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  let signupId: unknown;
  try {
    ({ signupId } = await request.json());
  } catch {
    return json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (typeof signupId !== 'string' || !signupId) {
    return json({ error: 'signupId is required' }, { status: 400 });
  }

  const db = getSupabase() as any;

  const { data: signup } = await db
    .from('verified_vibe_beta_signups')
    .select('id, email, platform, referrer_id, link_id')
    .eq('id', signupId)
    .maybeSingle();
  if (!signup) {
    return json({ error: 'Signup not found' }, { status: 404 });
  }

  // The device is an ordering hint, not a requirement: the email carries both
  // store links (open testing, 2026-08-03). A row with no device on file — every
  // signup collected before device capture — used to be un-invitable.
  const raw = signup.platform;
  const platform: Platform | null = raw === 'ios' || raw === 'android' ? raw : null;

  // The referrer card is a nice-to-have, never a gate. Admin recruiting links
  // carry no referrer_id at all, and a referrer row can be missing or fail to
  // load — in every one of those cases the invite still goes out, minus the card.
  //
  // A PRIVATE link (mode='private') suppresses the card on purpose: nothing about
  // its owner travelled with the link, and this email must not undo that. The
  // invite still goes out, with the card-less copy that promises no match.
  const isPrivateLink = (await signupLinkMode(db, signup.link_id)) === 'private';
  let referrer: ReferrerCard | null = null;
  if (signup.referrer_id && !isPrivateLink) {
    const { data } = await db
      .from('verified_vibe_users')
      .select('first_name, age, city, avatar_url, about')
      .eq('id', signup.referrer_id)
      .maybeSingle();
    referrer = (data as ReferrerCard | null) ?? null;
  }

  try {
    await sendEarlyAccessEmail(signup.email, referrer, platform);
  } catch (e) {
    console.error('[beta-invite-admin] Send failed:', e);
    return json({ error: 'Failed to send the invite email. Please try again.' }, { status: 502 });
  }

  const invitedAt = new Date().toISOString();
  await db
    .from('verified_vibe_beta_signups')
    .update({ invited_at: invitedAt })
    .eq('id', signup.id);

  return json({ success: true, invited_at: invitedAt });
};
