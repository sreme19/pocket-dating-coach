/**
 * POST /api/beta/submit
 *   Public endpoint behind the /beta/{token} landing page. Collects a
 *   prospective beta tester's email against a woman's referral link.
 *
 *   Body (JSON): { token, email, platform?, countryCode?, phone?, mood? }
 *
 * EMAIL is the only required field. `platform` is now the store button the person
 * tapped on the landing page rather than a self-declared dropdown — better data,
 * but still optional, because the row must land even if that tap is the last
 * thing that happens (the client posts fire-and-forget with keepalive). The
 * WhatsApp number is optional too: it existed for the manual invite chase, and
 * since open testing there is no chase. Both are still accepted so the rows
 * already collected, and any older client, keep working.
 *
 * No auth (public), service-role write. First invite wins: if the email is
 * already on the list, the original referrer is kept and we report success
 * without leaking whether it existed (the device platform is refreshed on the
 * existing row so a re-submit can correct it).
 *
 * On every accepted submit (new or duplicate) we send a confirmation email
 * with the referring woman's card — EXCEPT on a private link (mode='private'),
 * where the card is suppressed: that link carried nothing about its owner, and
 * the email is not a back door around it. A light per-link rate limit caps how
 * many signups a single link can drive per hour, so the public endpoint can't be
 * used to spray email at arbitrary addresses.
 *
 * Since open testing (2026-08-03) that confirmation IS the invite: it carries
 * both store links, and the landing page shows them too. Nobody waits on an
 * admin adding them as a tester any more.
 *
 * The row still matters, which is why this form still exists: the beta_signups
 * email is the ONLY thing tying a joiner back to their referrer, and it is what
 * redeemBetaInviteIfEligible / awardReferralRewardIfEligible look up to form the
 * match and pay the referral. No row, no attribution.
 *
 * A NEW row also alerts the team inbox so a referral landing is noticed without
 * anyone watching the admin tab. Only new rows: a duplicate re-submit adds
 * nothing to the Collected emails list, so alerting on one would just be noise.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
import {
  sendBetaConfirmationEmail,
  sendNewSignupAlert,
  type NewSignupAlert,
  type ReferrerCard,
} from '$lib/server/beta-invite-email';
import type { Platform } from '$lib/store-links';
import { modeOf, selectReferralLinks } from '$lib/server/referral-links';
import { formatPhone, parsePhone } from '$lib/phone';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Abuse guard: at most this many signups per link within the rolling window.
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** Postgres: column does not exist — i.e. the WhatsApp migration hasn't run. */
const UNDEFINED_COLUMN = '42703';

function warnMissingWhatsappColumns(): void {
  console.error(
    '[beta-submit] verified_vibe_beta_signups.whatsapp_* is missing — run migration ' +
      '20260728013000_add_whatsapp_to_beta_signups.sql. The signup was saved WITHOUT the number.'
  );
}

/**
 * The referrer's card, or null. No referrer (admin recruiting link) and an
 * unloadable one are both fine — every caller has card-less copy to fall back on.
 */
async function loadReferrerCard(db: any, referrerId: string | null): Promise<ReferrerCard | null> {
  if (!referrerId) return null;
  try {
    const { data } = await db
      .from('verified_vibe_users')
      .select('first_name, age, city, avatar_url, about')
      .eq('id', referrerId)
      .maybeSingle();
    return (data as ReferrerCard | null) ?? null;
  } catch (e) {
    console.error('[beta-submit] Referrer load failed (non-fatal):', e);
    return null;
  }
}

/**
 * Send the confirmation. Non-fatal: never throws.
 *
 * `device` only orders the two store buttons — the email carries both, so an
 * unknown device costs a glance rather than the download.
 */
async function sendConfirmation(
  toEmail: string,
  referrer: ReferrerCard | null,
  device: Platform | null
): Promise<void> {
  try {
    await sendBetaConfirmationEmail(toEmail, referrer, device);
  } catch (e) {
    console.error('[beta-submit] Confirmation email failed (non-fatal):', e);
  }
}

/**
 * Alert the team that a new row landed in the Collected emails list. Non-fatal:
 * never throws. The row is already saved and the admin tab stays the source of
 * truth, so a Resend hiccup must not turn a good signup into an error for the
 * person who just typed their email.
 *
 * The list position is a nicety on top — if the count fails, the alert still goes.
 */
async function alertTeam(db: any, signup: Omit<NewSignupAlert, 'total'>): Promise<void> {
  let total: number | null = null;
  try {
    const { count } = await db
      .from('verified_vibe_beta_signups')
      .select('id', { count: 'exact', head: true });
    total = count ?? null;
  } catch (e) {
    console.error('[beta-submit] Signup count failed (alert still sent):', e);
  }
  try {
    await sendNewSignupAlert({ ...signup, total });
  } catch (e) {
    console.error('[beta-submit] New-signup alert failed (non-fatal):', e);
  }
}

export const POST: RequestHandler = async ({ request }) => {
  let token: unknown;
  let email: unknown;
  let platform: unknown;
  let mood: unknown;
  let countryCode: unknown;
  let phone: unknown;
  try {
    ({ token, email, platform, mood, countryCode, phone } = await request.json());
  } catch {
    return json({ error: 'Invalid request' }, { status: 400 });
  }

  if (typeof token !== 'string' || !token) {
    return json({ error: 'Invalid link.' }, { status: 400 });
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }
  // WhatsApp number — OPTIONAL since the landing page stopped asking for one.
  // When a number IS supplied it is re-validated here with the same helper the
  // old form used: the column CHECKs assume normalized input, and that guarantee
  // can't come from a value the browser supplied. Length-capped before parsing so
  // a megabyte of digits can't be handed to the regexes.
  const rawPhone = typeof phone === 'string' ? phone.slice(0, 32) : '';
  const rawCode = typeof countryCode === 'string' ? countryCode : '';
  let whatsapp: { whatsapp_country_code: string; whatsapp_number: string } | null = null;
  if (rawPhone) {
    const parsedPhone = parsePhone(rawCode, rawPhone);
    if (!parsedPhone.ok) {
      return json({ error: parsedPhone.error }, { status: 400 });
    }
    whatsapp = {
      whatsapp_country_code: rawCode,
      whatsapp_number: parsedPhone.national,
    };
  }
  const normalized = email.trim().toLowerCase();
  const device: Platform | null =
    platform === 'ios' || platform === 'android' ? platform : null;
  // Optional referral framing (women-invite flow), carried via /beta/<token>?m=.
  // Stored for the landing/copy + reward record; never drives onboarding.
  const MOODS = ['networking', 'casual', 'serious'];
  const moodVal = typeof mood === 'string' && MOODS.includes(mood) ? mood : null;

  const db = getSupabase() as any;

  const { rows: linkRows } = await selectReferralLinks(db, 'id, referrer_id, active', (q) =>
    q.eq('token', token).limit(1)
  );
  const link = linkRows[0] ?? null;
  if (!link || !link.active) {
    return json({ error: 'This invite link is no longer active.' }, { status: 404 });
  }

  // Loaded once and used two ways. A private link carries nothing about its
  // owner — including in the invitee's email, where passing no referrer switches
  // to the card-less copy (no photo, no promised match). The signup is still
  // attributed, and the TEAM alert still names her: the admin tab does too, and
  // an alert that hid who drove the signup couldn't be followed up.
  const referrer = await loadReferrerCard(db, link.referrer_id);
  const cardReferrer = modeOf(link) === 'private' ? null : referrer;
  const linkLabel = !link.referrer_id
    ? 'Admin recruiting link'
    : modeOf(link) === 'private'
      ? 'Personal link (private)'
      : 'Personal link';

  // First invite wins: if this email is already collected, keep the original
  // row — but still (re)send the confirmation so the person is acknowledged.
  const { data: existing } = await db
    .from('verified_vibe_beta_signups')
    .select('id')
    .eq('email', normalized)
    .maybeSingle();
  if (existing) {
    // Keep the original referrer, but refresh what they just told us. A null
    // device would overwrite a good value with nothing, and a number we were not
    // sent is not a correction — so only write the fields actually present.
    // Pre-migration, fall back to the device alone rather than losing it too.
    const patch: Record<string, unknown> = {};
    if (device) patch.platform = device;
    if (whatsapp) Object.assign(patch, whatsapp);
    if (Object.keys(patch).length > 0) {
      const { error: updateError } = await db
        .from('verified_vibe_beta_signups')
        .update(patch)
        .eq('id', existing.id);
      if (updateError && `${updateError.code}` === UNDEFINED_COLUMN) {
        warnMissingWhatsappColumns();
        if (device) {
          await db
            .from('verified_vibe_beta_signups')
            .update({ platform: device })
            .eq('id', existing.id);
        }
      }
    }
    // No team alert here on purpose: the list is unchanged, so an alert would be
    // a reminder about a row somebody was already told about.
    await sendConfirmation(normalized, cardReferrer, device);
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

  const row = {
    link_id: link.id,
    referrer_id: link.referrer_id,
    email: normalized,
    platform: device,
    mood: moodVal,
    status: 'pending',
  };

  let { error } = await db
    .from('verified_vibe_beta_signups')
    .insert({ ...row, ...(whatsapp ?? {}) });

  // Code can reach production before the migration is run by hand (Vercel
  // deploys from main; migrations are applied in the SQL editor). Without this
  // retry, the undefined-column error would fall into the branch below and
  // report success to the user while collecting nobody — so save the signup
  // number-less and shout in the logs instead.
  if (error && `${error.code}` === UNDEFINED_COLUMN) {
    warnMissingWhatsappColumns();
    ({ error } = await db.from('verified_vibe_beta_signups').insert(row));
  }

  if (error) {
    // Unique-violation race (someone inserted the same email between our check
    // and insert) → still a success from the user's perspective. Confirm anyway.
    // No alert: whoever won the race collected the row, and alerted for it.
    await sendConfirmation(normalized, cardReferrer, device);
    return json({ success: true });
  }

  // A genuinely new row: confirm the person AND remind the team to invite them.
  // In parallel — the person is waiting on this response, and neither send can
  // reject (both swallow their own failures).
  await Promise.all([
    sendConfirmation(normalized, cardReferrer, device),
    alertTeam(db, {
      email: normalized,
      whatsapp: whatsapp
        ? formatPhone(whatsapp.whatsapp_country_code, whatsapp.whatsapp_number)
        : '',
      platform: device,
      referrerName: referrer?.first_name?.trim() || null,
      linkLabel,
      mood: moodVal,
    }),
  ]);
  return json({ success: true });
};
