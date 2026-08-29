import { json, text } from '@sveltejs/kit';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { normalisePhone, normaliseEmail, recordAdLead } from '$lib/server/marketing-leads';
import { recordApplyGate, UNDER_18 } from '$lib/server/apply-gate';

/**
 * POST /api/marketing/snap-lead
 *
 * Snap's lead-form webhook. The only programmatic way lead data leaves Snap:
 * the Marketing API exposes form METADATA
 * (GET /v1/adaccounts/{id}/lead_generation_forms) but has no endpoint that lists
 * or downloads submissions. Registration is per-form, one webhook each, via
 * POST /v1/lead_gen/integrations/public_webhook — see ad-management-agent's
 * `ad-agent snap-leads register`.
 *
 * DELIVERY IS FORWARD-ONLY. Snap does not backfill a newly registered webhook,
 * and drops leads after 90 days. Anything submitted before registration exists
 * only in the Ads Manager export.
 *
 * NOT A BEACON AND NOT A FORM. The sibling endpoints under /api/marketing answer
 * a browser; this answers a machine that retries. Three consequences run through
 * the whole file:
 *
 *   - A duplicate is a SUCCESS. Snap redelivers anything it did not get a 2xx
 *     for, so a redelivered lead must answer 200 or it will be retried forever.
 *   - A database failure is a 500, deliberately. Everywhere else in this repo a
 *     failed write is swallowed so the visitor sees something sensible; here the
 *     retry is the only thing standing between a transient Supabase error and a
 *     permanently lost lead, and a 200 would suppress it.
 *   - Nothing is trusted because it arrived. The payload is authenticated by
 *     HMAC before a single field is read.
 */

/**
 * Snap signs HMAC-SHA256 over `{timestamp}.{body}` — NOT over the body alone —
 * using the hmacSecret returned when the integration was created (one secret per
 * ad account, shared by every integration under it). The timestamp arrives in
 * its own `t` header and is part of the signed message, so it cannot be ignored:
 * signing the body by itself produces a valid-looking hex string that never
 * matches, which is exactly how the first live test delivery failed 401.
 *
 * THE HEADER IS NAMED `signature`, observed from that delivery. The docs say
 * only that webhooks "contain a Signature header" without naming it, so the
 * other spellings stay as fallbacks — they cost nothing, every candidate is
 * checked against the same HMAC, and a rename would otherwise take the funnel
 * down silently.
 */
const SIGNATURE_HEADERS = [
	'signature',
	'x-snap-signature',
	'snap-signature',
	'x-snapchat-signature',
	'x-hub-signature-256'
];

/** Snap sends the signed timestamp separately, as `t`. */
const TIMESTAMP_HEADERS = ['t', 'x-snap-timestamp', 'snap-timestamp'];

/** A lead payload is small; anything large is not one. */
const MAX_BODY_BYTES = 64 * 1024;

function presentedSignature(headers: Headers): { name: string; value: string } | null {
	for (const name of SIGNATURE_HEADERS) {
		const raw = headers.get(name);
		if (raw) return { name, value: raw.trim() };
	}
	return null;
}

function presentedTimestamp(headers: Headers): string | null {
	for (const name of TIMESTAMP_HEADERS) {
		const raw = headers.get(name);
		if (raw) return raw.trim();
	}
	return null;
}

/**
 * Constant-time compare, tolerant of an `sha256=` prefix and of case.
 *
 * timingSafeEqual throws on a length mismatch rather than returning false, which
 * would turn a malformed signature into a 500 and a retry storm — hence the
 * explicit length check first.
 */
function signatureMatches(presented: string, expectedHex: string): boolean {
	const cleaned = presented.replace(/^sha256=/i, '').toLowerCase();
	if (cleaned.length !== expectedHex.length) return false;
	try {
		return timingSafeEqual(Buffer.from(cleaned, 'hex'), Buffer.from(expectedHex, 'hex'));
	} catch {
		return false;
	}
}

/**
 * Snap's ad squads encode gender in the name (SC_F_LEADS_*, SC_LEADS_M_TOF_*).
 *
 * WHITESPACE IS A SEPARATOR TOO, not just underscore. The live account mixes
 * conventions: most squads are SC_F_19-30_India, but hand-made ones are "Female
 * College" and "Female Leads". An underscore-only boundary reads those as
 * unknown, which is a silent null on real leads rather than a wrong guess — but
 * still a worse answer than the obvious one.
 */
function audienceFromNames(...names: (string | null)[]): 'man' | 'woman' | null {
	const haystack = names.filter(Boolean).join(' ').toUpperCase();
	const woman = /(^|[_\s])(F|W|WOMEN|WOMAN|FEMALE)([_\s]|$)/.test(haystack);
	const man = /(^|[_\s])(M|MEN|MAN|MALE)([_\s]|$)/.test(haystack);
	// Both or neither is genuinely unknown. audience is nullable, and a wrong
	// guess here silently mis-segments every report that groups by it.
	if (woman === man) return null;
	return woman ? 'woman' : 'man';
}

function str(value: unknown): string | null {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Whether a declared birthday puts her under 18 today.
 *
 * Returns null when the form did not collect one — which is the common case, and
 * is NOT the same as "she is an adult". The downstream age gate still applies.
 */
function isMinor(birthday: string | null): boolean | null {
	if (!birthday) return null;
	const born = new Date(birthday);
	if (Number.isNaN(born.getTime())) return null;
	const now = new Date();
	let age = now.getUTCFullYear() - born.getUTCFullYear();
	const monthDelta = now.getUTCMonth() - born.getUTCMonth();
	if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < born.getUTCDate())) age -= 1;
	return age < 18;
}

export const POST: RequestHandler = async ({ request }) => {
	const secret = env.SNAP_LEAD_HMAC_SECRET;
	if (!secret) {
		// 500 rather than 401: the caller is legitimate and the fault is ours, so
		// Snap should retry rather than treat the lead as rejected.
		console.error('[snap-lead] SNAP_LEAD_HMAC_SECRET is not set — refusing to accept leads');
		return json({ ok: false }, { status: 500 });
	}

	const declared = Number(request.headers.get('content-length') ?? 0);
	if (declared > MAX_BODY_BYTES) return json({ ok: false }, { status: 413 });

	// The signature covers the bytes as sent. Parsing first and re-serialising
	// would verify a different string than the one Snap signed.
	const raw = await request.text();
	if (raw.length > MAX_BODY_BYTES) return json({ ok: false }, { status: 413 });

	const presented = presentedSignature(request.headers);
	if (!presented) {
		console.error(
			'[snap-lead] no signature header. Saw:',
			[...request.headers.keys()].join(', ')
		);
		return json({ ok: false }, { status: 401 });
	}

	// `{timestamp}.{body}`, per Snap's Step 1. The timestamp is NOT optional —
	// without it the HMAC is computed over a different message than Snap signed.
	//
	// NO FRESHNESS WINDOW, deliberately. Including a timestamp in the signed
	// message is the shape used for replay protection, and the usual companion is
	// rejecting anything older than a few minutes. That would be wrong here: Snap
	// retries a delivery it did not get a 2xx for, an outage can push a retry well
	// past any sensible window, and rejecting it loses the lead permanently. The
	// replay this would defend against is already inert — snap_lead_id is unique,
	// so a replayed delivery is a no-op duplicate, not a second phone call.
	const timestamp = presentedTimestamp(request.headers);
	if (!timestamp) {
		console.error(
			'[snap-lead] no timestamp header. Saw:',
			[...request.headers.keys()].join(', ')
		);
		return json({ ok: false }, { status: 401 });
	}

	const expected = createHmac('sha256', secret)
		.update(`${timestamp}.${raw}`, 'utf8')
		.digest('hex');
	if (!signatureMatches(presented.value, expected)) {
		// 401 is final: a wrong signature will still be wrong on redelivery, so
		// there is nothing to retry. Never echo the expected value.
		console.error('[snap-lead] signature mismatch on header', presented.name);
		return json({ ok: false }, { status: 401 });
	}

	let body: Record<string, unknown>;
	try {
		body = JSON.parse(raw);
	} catch {
		// Authenticated but unparseable. Retrying cannot fix it, so answer 400 and
		// let it stop rather than looping.
		console.error('[snap-lead] authenticated payload was not JSON');
		return json({ ok: false }, { status: 400 });
	}

	const leadId = str(body.lead_id);
	if (!leadId) {
		console.error('[snap-lead] payload has no lead_id; keys:', Object.keys(body).join(', '));
		return json({ ok: false }, { status: 400 });
	}

	const campaignName = str(body.campaign_name);
	const adSquadName = str(body.ad_squad_name);
	const adName = str(body.ad_name);

	// UNDER-18 IS HANDLED BEFORE ANY CONTACT DETAIL IS STORED.
	//
	// 20260828184124 kept contact details out of marketing_apply_gate on purpose,
	// citing DPDP on a child's data, and could afford to because the lead lived in
	// Meta until someone exported it. This webhook removes that buffer: a minor's
	// phone number would land in Postgres the instant she submits. So the check
	// runs here, and a minor produces a suppression row carrying an opaque id and
	// nothing else — never a marketing_leads row. Storing then suppressing would
	// mean the contact details existed in our database, which is the thing the
	// rule is about.
	const minor = isMinor(str(body.birthday));
	if (minor === true) {
		const gate = await recordApplyGate({
			raLead: leadId,
			visitId: null,
			ageBand: UNDER_18,
			campaign: campaignName,
			utm: {},
			userAgent: null,
			country: null,
			city: null,
			region: null
		});
		// 500 so Snap retries: failing to record the suppression is worse than a
		// duplicate suppression row, because the alternative is no record that this
		// lead must be pulled from the export.
		if (!gate.ok) return json({ ok: false }, { status: 500 });
		return json({ ok: true, stored: false, reason: 'under_18' });
	}

	const phoneRaw = str(body.phone_number);
	const emailRaw = str(body.email);
	const whatsappE164 = phoneRaw ? normalisePhone(phoneRaw) : null;
	const email = emailRaw ? normaliseEmail(emailRaw) : null;

	if (!whatsappE164 && !email) {
		// Authenticated, well-formed, and unusable — an international number that
		// normalisePhone rejects by design, or a form collecting neither field.
		// 200 because redelivery will produce exactly the same result.
		console.warn('[snap-lead] no usable contact on lead', leadId, {
			hadPhone: Boolean(phoneRaw),
			hadEmail: Boolean(emailRaw)
		});
		return json({ ok: true, stored: false, reason: 'no_usable_contact' });
	}

	const result = await recordAdLead({
		network: 'snap_lead_form',
		adLeadId: leadId,
		adFormId: str(body.form_id),
		whatsappE164,
		email,
		firstName: str(body.first_name),
		lastName: str(body.last_name),
		audience: audienceFromNames(adSquadName, campaignName, adName),
		campaign: campaignName,
		adCampaignId: str(body.campaign_id),
		adGroupId: str(body.ad_squad_id),
		adGroupName: adSquadName,
		adId: str(body.ad_id),
		adName: adName,
		submittedAt: str(body.create_time)
	});

	// The one place a 500 is the right answer: the write failed for a reason a
	// redelivery might not hit, and Snap's retry is the only second chance.
	if (!result.ok) return json({ ok: false }, { status: 500 });

	return json({ ok: true, stored: !result.duplicate });
};

/**
 * Snap's `GET /v1/lead_gen/integrations/{id}/test` fires against this URL. A
 * plain 200 here makes "is the endpoint reachable" answerable without writing a
 * row, and confirms the deploy is live before any real lead depends on it.
 */
export const GET: RequestHandler = async () =>
	text(env.SNAP_LEAD_HMAC_SECRET ? 'ok' : 'missing SNAP_LEAD_HMAC_SECRET', {
		status: env.SNAP_LEAD_HMAC_SECRET ? 200 : 500
	});
