import { json, text } from '@sveltejs/kit';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { recordAdLead } from '$lib/server/marketing-leads';
import { recordApplyGate, UNDER_18 } from '$lib/server/apply-gate';
import {
	fetchLead,
	isMinor,
	pageToken,
	resolveNames,
	toAdLead,
	type RawLead
} from '$lib/server/meta-leads';

/**
 * POST /api/marketing/meta-lead — Meta's leadgen webhook.
 * GET  /api/marketing/meta-lead — Meta's subscription verification handshake.
 *
 * SIBLING OF THE SNAP RECEIVER, with three differences that are not cosmetic:
 *
 *  1. **The webhook does not carry the lead.** It carries a `leadgen_id`, and
 *     the fields are a second Graph call away. So a delivery can fail for a
 *     reason that has nothing to do with the delivery — an expired token, a
 *     missing permission — and those must answer 500 so Meta retries, not 200.
 *  2. **Meta signs with the APP SECRET, not a per-integration secret**, as
 *     `X-Hub-Signature-256: sha256=<hex>` over the raw body.
 *  3. **A GET handshake creates the subscription.** Meta echoes a challenge and
 *     will not deliver anything until it is answered.
 *
 * Everything else matches the Snap route deliberately: duplicates are 200 so
 * retries stop, write failures are 500 so the retry is the second chance, and an
 * under-18 submission never becomes a lead row.
 */

/** Meta batches: one payload can carry several leads across several entries. */
interface Change {
	field?: string;
	value?: { leadgen_id?: string; form_id?: string; created_time?: number };
}

function appSecret(): string | null {
	return env.META_APP_SECRET || null;
}

function signatureOk(raw: string, header: string | null, secret: string): boolean {
	if (!header) return false;
	const presented = header.replace(/^sha256=/i, '').trim().toLowerCase();
	const expected = createHmac('sha256', secret).update(raw, 'utf8').digest('hex');
	if (presented.length !== expected.length) return false;
	try {
		return timingSafeEqual(Buffer.from(presented, 'hex'), Buffer.from(expected, 'hex'));
	} catch {
		return false;
	}
}

/**
 * GET is the subscription handshake. Meta sends hub.mode=subscribe with a token
 * that must equal META_LEAD_VERIFY_TOKEN, and expects hub.challenge echoed back
 * as bare text — not JSON, not quoted.
 *
 * With no verify token configured this answers a plain health line instead, so
 * the route is still reachable to check before it is wired up.
 */
export const GET: RequestHandler = async ({ url }) => {
	const mode = url.searchParams.get('hub.mode');
	const token = url.searchParams.get('hub.verify_token');
	const challenge = url.searchParams.get('hub.challenge');
	const expected = env.META_LEAD_VERIFY_TOKEN;

	if (mode === 'subscribe') {
		if (!expected) {
			console.error('[meta-lead] verification attempted but META_LEAD_VERIFY_TOKEN is not set');
			return text('missing META_LEAD_VERIFY_TOKEN', { status: 500 });
		}
		if (token !== expected) {
			console.error('[meta-lead] verification failed: verify_token mismatch');
			return text('forbidden', { status: 403 });
		}
		return text(challenge ?? '', { status: 200 });
	}

	const missing = [
		!appSecret() && 'META_APP_SECRET',
		!env.META_LEAD_VERIFY_TOKEN && 'META_LEAD_VERIFY_TOKEN',
		!env.META_PAGE_ID && 'META_PAGE_ID',
		!(env.META_MARKETING_TOKEN ?? env.META_ADS_TOKEN) && 'META_MARKETING_TOKEN'
	].filter(Boolean);
	return missing.length
		? text(`missing ${missing.join(', ')}`, { status: 500 })
		: text('ok', { status: 200 });
};

export const POST: RequestHandler = async ({ request }) => {
	const secret = appSecret();
	if (!secret) {
		// 500 not 401: the caller is legitimate and the fault is ours, so Meta
		// should retry rather than treat the lead as rejected.
		console.error('[meta-lead] META_APP_SECRET is not set — refusing to accept leads');
		return json({ ok: false }, { status: 500 });
	}

	// Signed over the bytes as sent, so parse only after verifying.
	const raw = await request.text();
	if (!signatureOk(raw, request.headers.get('x-hub-signature-256'), secret)) {
		// Final: a wrong signature will still be wrong on redelivery.
		console.error('[meta-lead] signature mismatch');
		return json({ ok: false }, { status: 401 });
	}

	let body: { entry?: Array<{ changes?: Change[] }> };
	try {
		body = JSON.parse(raw);
	} catch {
		console.error('[meta-lead] authenticated payload was not JSON');
		return json({ ok: false }, { status: 400 });
	}

	const ids = (body.entry ?? [])
		.flatMap((e) => e.changes ?? [])
		.filter((c) => c.field === 'leadgen')
		.map((c) => c.value?.leadgen_id)
		.filter((id): id is string => Boolean(id));

	if (!ids.length) return json({ ok: true, leads: 0 });

	// One token for the whole batch. If this throws the payload is untouched and
	// the 500 below asks Meta to send it again — which is right, because a token
	// or permission failure is ours to fix and the lead is not recoverable
	// anywhere else.
	let token: string;
	try {
		token = await pageToken();
	} catch (err) {
		console.error('[meta-lead] cannot obtain a page token', err);
		return json({ ok: false }, { status: 500 });
	}

	const names = new Map<string, string>();
	let stored = 0;
	let skipped = 0;

	for (const id of ids) {
		let lead: RawLead;
		try {
			lead = await fetchLead(id, token);
		} catch (err) {
			// Includes "(#200) Requires leads_retrieval permission". Retryable:
			// granting the permission later makes the redelivery succeed.
			console.error('[meta-lead] could not fetch lead', id, err);
			return json({ ok: false }, { status: 500 });
		}

		// Before anything is stored — same rule and same reasoning as the Snap
		// route. The webhook is what removes the buffer that kept a minor's
		// contact details inside Meta until someone exported them.
		if (isMinor(lead) === true) {
			const gate = await recordApplyGate({
				raLead: lead.id,
				visitId: null,
				ageBand: UNDER_18,
				campaign: null,
				utm: {},
				userAgent: null,
				country: null,
				city: null,
				region: null
			});
			if (!gate.ok) return json({ ok: false }, { status: 500 });
			skipped++;
			continue;
		}

		await resolveNames([lead.adset_id, lead.campaign_id, lead.ad_id].filter(Boolean) as string[], token, names);

		const mapped = toAdLead(lead, names);
		if (!mapped) {
			console.warn('[meta-lead] no usable contact on lead', lead.id);
			skipped++;
			continue;
		}

		const result = await recordAdLead(mapped);
		if (!result.ok) return json({ ok: false }, { status: 500 });
		if (!result.duplicate) stored++;
	}

	return json({ ok: true, leads: ids.length, stored, skipped });
};
