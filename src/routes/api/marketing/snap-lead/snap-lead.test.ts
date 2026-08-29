import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';

/**
 * The Snap lead webhook.
 *
 * Two things here must never be wrong, and they are the reason this file exists:
 *
 *   1. An unsigned or wrongly-signed body must never write a row. The endpoint is
 *      unauthenticated except for the HMAC, and it writes to a contact list.
 *   2. An under-18 submission must never write contact details. The migration
 *      that added these columns is explicit about DPDP and a child's data, and
 *      the webhook is what removed the buffer that used to make it moot.
 *
 * Everything else is retry semantics: Snap redelivers anything it does not get a
 * 2xx for, so which failures answer 500 and which answer 200/400 decides whether
 * a transient error loses a lead or loops forever.
 */

const SECRET = 'test-hmac-secret';

const recordSnapLead = vi.fn();
const recordApplyGate = vi.fn();

vi.mock('$env/dynamic/private', () => ({ env: { SNAP_LEAD_HMAC_SECRET: SECRET } }));

vi.mock('$lib/server/marketing-leads', async () => {
	// normalisePhone/normaliseEmail are pure and already covered by their own
	// tests, so the real ones run here — the mapping from Snap's fields to them is
	// exactly what this file is checking.
	const actual = await vi.importActual<typeof import('$lib/server/marketing-leads')>(
		'$lib/server/marketing-leads'
	);
	return { ...actual, recordSnapLead };
});

vi.mock('$lib/server/apply-gate', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/apply-gate')>(
		'$lib/server/apply-gate'
	);
	return { ...actual, recordApplyGate };
});

const { POST } = await import('./+server');

function sign(body: string, secret = SECRET): string {
	return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

function payload(extra: Record<string, unknown> = {}) {
	return JSON.stringify({
		lead_id: 'lead-abc-123',
		form_id: 'form-1',
		form_name: 'RA lead form',
		ad_account_id: 'acct-1',
		campaign_id: 'camp-1',
		campaign_name: 'SC_F_LEADS_20260817',
		ad_squad_id: 'squad-1',
		ad_squad_name: 'SC_F_LEADS_W_1830',
		ad_id: 'ad-1',
		ad_name: 'SC_F_LEADS_AD',
		create_time: '2026-08-29T10:00:00Z',
		phone_number: '+91 98765 43210',
		email: 'Her@Example.COM',
		first_name: 'Asha',
		...extra
	});
}

/** The endpoint reads the raw body, so a Request is the honest way to call it. */
function call(body: string, headers: Record<string, string>) {
	const request = new Request('https://x.example/api/marketing/snap-lead', {
		method: 'POST',
		body,
		headers
	});
	return POST({ request } as never);
}

beforeEach(() => {
	vi.clearAllMocks();
	recordSnapLead.mockResolvedValue({ ok: true, duplicate: false });
	recordApplyGate.mockResolvedValue({ ok: true });
});

describe('signature gate', () => {
	it('accepts a correctly signed body', async () => {
		const body = payload();
		const res = await call(body, { 'x-snap-signature': sign(body) });
		expect(res.status).toBe(200);
		expect(recordSnapLead).toHaveBeenCalledOnce();
	});

	it('rejects a body with no signature header and writes nothing', async () => {
		const res = await call(payload(), {});
		expect(res.status).toBe(401);
		expect(recordSnapLead).not.toHaveBeenCalled();
	});

	it('rejects a signature computed with the wrong secret', async () => {
		const body = payload();
		const res = await call(body, { 'x-snap-signature': sign(body, 'not-the-secret') });
		expect(res.status).toBe(401);
		expect(recordSnapLead).not.toHaveBeenCalled();
	});

	it('rejects a body altered after signing', async () => {
		// The whole point of signing the raw bytes: a tampered payload must not
		// validate against the signature of the original.
		const signature = sign(payload());
		const tampered = payload({ phone_number: '+91 99999 99999' });
		const res = await call(tampered, { 'x-snap-signature': signature });
		expect(res.status).toBe(401);
		expect(recordSnapLead).not.toHaveBeenCalled();
	});

	it('rejects a malformed signature without throwing a 500', async () => {
		// timingSafeEqual throws on a length mismatch. If that escaped, a junk
		// header would become a 500 and Snap would retry it forever.
		const body = payload();
		for (const bad of ['', 'zz', 'not-hex-at-all', sign(body).slice(0, 20)]) {
			const res = await call(body, { 'x-snap-signature': bad });
			expect(res.status, bad).toBe(401);
		}
	});

	it('accepts the sha256= prefix form and is case-insensitive', async () => {
		const body = payload();
		const res = await call(body, { 'x-snap-signature': `sha256=${sign(body).toUpperCase()}` });
		expect(res.status).toBe(200);
	});
});

describe('under-18 handling', () => {
	it('records a suppression row and never a lead', async () => {
		const body = payload({ birthday: '2012-01-01' });
		const res = await call(body, { 'x-snap-signature': sign(body) });

		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ stored: false, reason: 'under_18' });
		// The assertion this file exists for.
		expect(recordSnapLead).not.toHaveBeenCalled();
		expect(recordApplyGate).toHaveBeenCalledOnce();

		// And the suppression row carries an opaque id, not her details.
		const [gate] = recordApplyGate.mock.calls[0];
		expect(gate.raLead).toBe('lead-abc-123');
		expect(gate.ageBand).toBe('under-18');
		expect(JSON.stringify(gate)).not.toContain('98765');
		expect(JSON.stringify(gate)).not.toContain('Asha');
	});

	it('treats an adult birthday normally', async () => {
		const body = payload({ birthday: '1998-06-15' });
		const res = await call(body, { 'x-snap-signature': sign(body) });
		expect(res.status).toBe(200);
		expect(recordSnapLead).toHaveBeenCalledOnce();
		expect(recordApplyGate).not.toHaveBeenCalled();
	});

	it('stores the lead when no birthday was collected', async () => {
		// The common case. "Unknown age" is not "minor" — the downstream gate is
		// what covers it — but it must not silently drop the lead either.
		const body = payload();
		await call(body, { 'x-snap-signature': sign(body) });
		expect(recordSnapLead).toHaveBeenCalledOnce();
		expect(recordApplyGate).not.toHaveBeenCalled();
	});

	it('answers 500 when the suppression row cannot be written', async () => {
		// Losing the suppression record is worse than a duplicate one: it is the
		// only trace that this lead must be pulled from the Ads Manager export.
		recordApplyGate.mockResolvedValue({ ok: false, reason: 'boom' });
		const body = payload({ birthday: '2012-01-01' });
		const res = await call(body, { 'x-snap-signature': sign(body) });
		expect(res.status).toBe(500);
	});
});

describe('field mapping', () => {
	it('normalises the contact and marks the kind as phone, not whatsapp', async () => {
		const body = payload();
		await call(body, { 'x-snap-signature': sign(body) });

		const [lead] = recordSnapLead.mock.calls[0];
		expect(lead.whatsappE164).toBe('+919876543210');
		expect(lead.email).toBe('her@example.com');
		expect(lead.snapLeadId).toBe('lead-abc-123');
		expect(lead.submittedAt).toBe('2026-08-29T10:00:00Z');
		expect(lead.snapAdSquadName).toBe('SC_F_LEADS_W_1830');
	});

	it('derives audience from the F/M marker in the ad squad name', async () => {
		const body = payload();
		await call(body, { 'x-snap-signature': sign(body) });
		expect(recordSnapLead.mock.calls[0][0].audience).toBe('woman');
	});

	it('reads space-separated names, not just underscore-separated ones', async () => {
		// The live account mixes conventions: "Female College" and "Female Leads"
		// are real ad squad and campaign names alongside SC_F_19-30_India.
		const body = payload({
			ad_squad_name: 'Female College',
			campaign_name: 'Female Leads',
			ad_name: 'Female Leads'
		});
		await call(body, { 'x-snap-signature': sign(body) });
		expect(recordSnapLead.mock.calls[0][0].audience).toBe('woman');
	});

	it('does not read WOMEN as MEN', async () => {
		// WOMEN_18-35_CASUAL_STORY_IND_LEADS is a real squad. If the man pattern
		// matched the MEN inside WOMEN, every female lead would be mislabelled.
		const body = payload({
			ad_squad_name: 'WOMEN_18-35_CASUAL_STORY_IND_LEADS',
			campaign_name: 'RA_LEADS_CASUAL_WOMEN_TOF_20260815',
			ad_name: 'RA_LEADS_AD'
		});
		await call(body, { 'x-snap-signature': sign(body) });
		expect(recordSnapLead.mock.calls[0][0].audience).toBe('woman');
	});

	it('leaves audience null rather than guessing when the names say nothing', async () => {
		// A wrong guess here silently mis-segments every report grouped by audience,
		// which is worse than an honest null.
		const body = payload({
			ad_squad_name: 'SC_LEADS_TOF',
			campaign_name: 'SC_LEADS_TOF',
			ad_name: 'SC_LEADS_AD'
		});
		await call(body, { 'x-snap-signature': sign(body) });
		expect(recordSnapLead.mock.calls[0][0].audience).toBeNull();
	});

	it('drops an unusable contact with a 200 so it is not retried forever', async () => {
		// A non-Indian number normalisePhone rejects by design. Redelivery would
		// produce exactly the same result, so there is nothing to retry.
		const body = payload({ phone_number: '+44 7700 900123', email: null });
		const res = await call(body, { 'x-snap-signature': sign(body) });
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ stored: false, reason: 'no_usable_contact' });
		expect(recordSnapLead).not.toHaveBeenCalled();
	});
});

describe('retry semantics', () => {
	it('answers 200 to a redelivered lead so Snap stops retrying', async () => {
		recordSnapLead.mockResolvedValue({ ok: true, duplicate: true });
		const body = payload();
		const res = await call(body, { 'x-snap-signature': sign(body) });
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ ok: true, stored: false });
	});

	it('answers 500 on a write failure so the retry is the second chance', async () => {
		recordSnapLead.mockResolvedValue({ ok: false, reason: 'transient' });
		const body = payload();
		const res = await call(body, { 'x-snap-signature': sign(body) });
		expect(res.status).toBe(500);
	});

	it('answers 400 to an authenticated body that is not JSON', async () => {
		// Authenticated but unparseable — retrying cannot fix it.
		const body = 'not json at all';
		const res = await call(body, { 'x-snap-signature': sign(body) });
		expect(res.status).toBe(400);
	});

	it('answers 400 to an authenticated payload with no lead_id', async () => {
		const body = JSON.stringify({ form_id: 'form-1', phone_number: '9876543210' });
		const res = await call(body, { 'x-snap-signature': sign(body) });
		expect(res.status).toBe(400);
		expect(recordSnapLead).not.toHaveBeenCalled();
	});
});
