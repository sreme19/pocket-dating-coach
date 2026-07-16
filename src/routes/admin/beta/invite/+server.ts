/**
 * POST /admin/beta/invite
 *   Send the early-access invite email to a collected beta signup, after a
 *   human has manually added them as an iOS/Android tester. Congratulates
 *   them, shows the matched woman's card, and links the right app store.
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
import { sendEarlyAccessEmail, storeUrlFor, type Platform } from '$lib/server/beta-invite-email';

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
    .select('id, email, platform, referrer_id')
    .eq('id', signupId)
    .maybeSingle();
  if (!signup) {
    return json({ error: 'Signup not found' }, { status: 404 });
  }

  const platform = signup.platform as Platform | null;
  if (platform !== 'ios' && platform !== 'android') {
    return json({ error: 'No device on file for this signup — cannot pick a store link.' }, { status: 400 });
  }
  if (!storeUrlFor(platform)) {
    return json(
      { error: `The ${platform === 'ios' ? 'iOS' : 'Android'} store link isn't configured yet.` },
      { status: 400 }
    );
  }

  const { data: referrer } = await db
    .from('verified_vibe_users')
    .select('first_name, age, city, avatar_url, about')
    .eq('id', signup.referrer_id)
    .maybeSingle();
  if (!referrer) {
    return json({ error: 'Matched user not found' }, { status: 404 });
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
