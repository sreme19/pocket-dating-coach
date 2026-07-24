/**
 * POST /api/beta/submit
 *   Public endpoint behind the /beta/{token} landing page. Collects a
 *   prospective beta tester's email against a woman's referral link.
 *
 *   Body (JSON): { token: string, email: string, platform: 'ios' | 'android' }
 *
 * No auth (public), service-role write. First invite wins: if the email is
 * already on the list, the original referrer is kept and we report success
 * without leaking whether it existed (the device platform is refreshed on the
 * existing row so a re-submit can correct it).
 *
 * On every accepted submit (new or duplicate) we send a confirmation email
 * with the referring woman's card. A light per-link rate limit caps how many
 * signups a single link can drive per hour, so the public endpoint can't be
 * used to spray email at arbitrary addresses.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
import { sendBetaConfirmationEmail } from '$lib/server/beta-invite-email';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLATFORMS = ['ios', 'android'] as const;
type Platform = (typeof PLATFORMS)[number];

// Abuse guard: at most this many signups per link within the rolling window.
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** Fetch the referrer card and send the confirmation. Non-fatal: never throws. */
async function sendConfirmation(db: any, referrerId: string, toEmail: string): Promise<void> {
  try {
    const { data: referrer } = await db
      .from('verified_vibe_users')
      .select('first_name, age, city, avatar_url, about')
      .eq('id', referrerId)
      .maybeSingle();
    if (!referrer) return;
    await sendBetaConfirmationEmail(toEmail, referrer);
  } catch (e) {
    console.error('[beta-submit] Confirmation email failed (non-fatal):', e);
  }
}

export const POST: RequestHandler = async ({ request }) => {
  let token: unknown;
  let email: unknown;
  let platform: unknown;
  let mood: unknown;
  try {
    ({ token, email, platform, mood } = await request.json());
  } catch {
    return json({ error: 'Invalid request' }, { status: 400 });
  }

  if (typeof token !== 'string' || !token) {
    return json({ error: 'Invalid link.' }, { status: 400 });
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }
  if (typeof platform !== 'string' || !PLATFORMS.includes(platform as Platform)) {
    return json({ error: 'Please select your phone type.' }, { status: 400 });
  }
  const normalized = email.trim().toLowerCase();
  const device = platform as Platform;
  // Optional referral framing (women-invite flow), carried via /beta/<token>?m=.
  // Stored for the landing/copy + reward record; never drives onboarding.
  const MOODS = ['networking', 'casual', 'serious'];
  const moodVal = typeof mood === 'string' && MOODS.includes(mood) ? mood : null;

  const db = getSupabase() as any;

  const { data: link } = await db
    .from('verified_vibe_referral_links')
    .select('id, referrer_id, active')
    .eq('token', token)
    .maybeSingle();
  if (!link || !link.active) {
    return json({ error: 'This invite link is no longer active.' }, { status: 404 });
  }

  // First invite wins: if this email is already collected, keep the original
  // row — but still (re)send the confirmation so the person is acknowledged.
  const { data: existing } = await db
    .from('verified_vibe_beta_signups')
    .select('id')
    .eq('email', normalized)
    .maybeSingle();
  if (existing) {
    // Keep the original referrer, but refresh the device in case they corrected it.
    await db
      .from('verified_vibe_beta_signups')
      .update({ platform: device })
      .eq('id', existing.id);
    await sendConfirmation(db, link.referrer_id, normalized);
    return json({ success: true });
  }

  // Abuse guard: cap new signups per link within the rolling window. Counts
  // rows created for this link recently — no PII (e.g. IP) is stored.
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count } = await db
    .from('verified_vibe_beta_signups')
    .select('id', { count: 'exact', head: true })
    .eq('link_id', link.id)
    .gte('created_at', windowStart);
  if ((count ?? 0) >= RATE_LIMIT_MAX) {
    return json({ error: 'Too many signups right now. Please try again later.' }, { status: 429 });
  }

  const { error } = await db.from('verified_vibe_beta_signups').insert({
    link_id: link.id,
    referrer_id: link.referrer_id,
    email: normalized,
    platform: device,
    mood: moodVal,
    status: 'pending',
  });

  if (error) {
    // Unique-violation race (someone inserted the same email between our check
    // and insert) → still a success from the user's perspective. Confirm anyway.
    await sendConfirmation(db, link.referrer_id, normalized);
    return json({ success: true });
  }

  await sendConfirmation(db, link.referrer_id, normalized);
  return json({ success: true });
};
