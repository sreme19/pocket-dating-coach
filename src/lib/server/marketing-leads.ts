/**
 * Record a contactable lead from a paid landing page.
 *
 * WHY THIS EXISTS. `marketing_leads` was created on 2026-08-15 with a dialer, a
 * call schedule and an email drip already hanging off it, and nothing has ever
 * written a row: /get and /get/w carry a Play Store button and nothing else, so
 * every visitor who is not on Android — and every visitor who is not ready to
 * install today — leaves no trace we can follow up. Meanwhile TrulyMadly and
 * BharatMatrimony both put OTP phone capture in the hero and Shaadi.com opens
 * with a preference picker before it asks for anything. Three independent players
 * converged on capturing contact above the fold; we captured none.
 *
 * THE CONTRACT IS DIFFERENT FROM THE BEACONS. marketing-page-views.ts and the
 * store-click path never throw and always answer 204, because nobody is waiting
 * on them. Somebody IS waiting on this one: she typed her number and is looking
 * at a button. So this returns a discriminated result the endpoint can turn into
 * a real message, and the caller is expected to say something either way.
 *
 * A REPEAT SUBMISSION IS A SUCCESS, NOT AN ERROR. The table carries unique
 * indexes on the phone and on lower(email). Someone who submits twice — a double
 * tap, a reload, a second visit from a different ad — must see the same
 * confirmation as the first time. Telling her "you are already on the list" is
 * both a worse experience and a membership oracle for anyone who wants to test
 * whether a number is registered, so the answer is identical either way.
 */

import { getSupabase } from '$lib/server/supabase';
import type { LandingPage } from '$lib/marketing/page-view-report';

export type LeadAudience = 'man' | 'woman';
export type LeadContactKind = 'whatsapp' | 'email';

export interface LeadInput {
	visitId: string | null;
	page: LandingPage;
	audience: LeadAudience;
	contactKind: LeadContactKind;
	/** Already normalised by normalisePhone/normaliseEmail — this module does not re-check shape. */
	whatsappE164: string | null;
	email: string | null;
	campaign: string | null;
	utm: Record<string, string>;
	userAgent: string | null;
	country: string | null;
	city: string | null;
	region: string | null;
}

export type LeadResult =
	| { ok: true; duplicate: boolean }
	/** The write failed. `reason` is for our logs; never show it to the visitor. */
	| { ok: false; reason: string };

/**
 * Indian mobile numbers, to E.164.
 *
 * Deliberately narrow: this form is served to Bangalore paid traffic and the
 * dialer that reads this table calls Indian numbers. Accepting +44 or +1 here
 * would write rows nothing downstream can act on. A visitor outside that range
 * is steered to email instead, which has no such constraint.
 *
 * Accepts 9876543210, 09876543210, 919876543210, +91 98765 43210, and the same
 * with hyphens or dots. Returns null for anything else, INCLUDING a leading
 * digit below 6 — Indian mobile numbers start 6, 7, 8 or 9, and a number
 * starting 1–5 is a landline or a typo, both of which the dialer cannot use.
 */
export function normalisePhone(raw: string): string | null {
	const digits = raw.replace(/[^\d]/g, '');
	const local = digits.startsWith('91') && digits.length === 12
		? digits.slice(2)
		: digits.startsWith('0') && digits.length === 11
			? digits.slice(1)
			: digits;

	if (!/^[6-9]\d{9}$/.test(local)) return null;
	return `+91${local}`;
}

/**
 * Email, lowercased and shape-checked.
 *
 * Shape only. There is no deliverability check and no confirmation mail, so a
 * typo'd address is stored and quietly never reaches anyone — worth knowing when
 * reading conversion numbers off this table. The regex is deliberately loose:
 * rejecting an unusual but valid address is a worse failure here than accepting
 * one that bounces.
 */
export function normaliseEmail(raw: string): string | null {
	const email = raw.trim().toLowerCase();
	if (email.length > 254) return null;
	return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email) ? email : null;
}

/** PostgreSQL unique_violation. PostgREST passes the SQLSTATE through untouched. */
const UNIQUE_VIOLATION = '23505';

export async function recordLead(input: LeadInput): Promise<LeadResult> {
	try {
		const supabase = getSupabase();

		const { error } = await supabase.from('marketing_leads').insert({
			visit_id: input.visitId,
			page: input.page,
			audience: input.audience,
			contact_kind: input.contactKind,
			whatsapp_e164: input.whatsappE164,
			email: input.email,
			campaign: input.campaign,
			utm: input.utm,
			user_agent: input.userAgent,
			country: input.country,
			city: input.city,
			region: input.region
		});

		if (error?.code === UNIQUE_VIOLATION) return { ok: true, duplicate: true };

		if (error) {
			// Logged loudly and on purpose. PostgREST reports a missing column, a
			// failed check constraint or an RLS refusal in `error` rather than
			// throwing, so without this a broken write is invisible — and this is
			// the table where an invisible failure means a lead we told someone we
			// had captured is simply not there.
			console.error('[marketing] lead NOT recorded:', error.code, error.message, error.hint ?? '');
			return { ok: false, reason: error.message };
		}

		return { ok: true, duplicate: false };
	} catch (err) {
		console.error('[marketing] failed to record lead', err);
		return { ok: false, reason: 'exception' };
	}
}
