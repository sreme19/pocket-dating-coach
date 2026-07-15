/**
 * POST /api/beta/submit
 *   Public endpoint behind the /beta/{token} landing page. Collects a
 *   prospective beta tester's email against a woman's referral link.
 *
 *   Body (JSON): { token: string, email: string }
 *
 * No auth (public), service-role write. First invite wins: if the email is
 * already on the list, the original referrer is kept and we report success
 * without leaking whether it existed.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: RequestHandler = async ({ request }) => {
  let token: unknown;
  let email: unknown;
  try {
    ({ token, email } = await request.json());
  } catch {
    return json({ error: 'Invalid request' }, { status: 400 });
  }

  if (typeof token !== 'string' || !token) {
    return json({ error: 'Invalid link.' }, { status: 400 });
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }
  const normalized = email.trim().toLowerCase();

  const db = getSupabase() as any;

  const { data: link } = await db
    .from('verified_vibe_referral_links')
    .select('id, referrer_id, active')
    .eq('token', token)
    .maybeSingle();
  if (!link || !link.active) {
    return json({ error: 'This invite link is no longer active.' }, { status: 404 });
  }

  // First invite wins: if this email is already collected, keep the original row.
  const { data: existing } = await db
    .from('verified_vibe_beta_signups')
    .select('id')
    .eq('email', normalized)
    .maybeSingle();
  if (existing) {
    return json({ success: true });
  }

  const { error } = await db.from('verified_vibe_beta_signups').insert({
    link_id: link.id,
    referrer_id: link.referrer_id,
    email: normalized,
    status: 'pending',
  });

  if (error) {
    // Unique-violation race (someone inserted the same email between our check
    // and insert) → still a success from the user's perspective.
    return json({ success: true });
  }

  return json({ success: true });
};
