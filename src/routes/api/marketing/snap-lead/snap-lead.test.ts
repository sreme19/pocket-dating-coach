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

const recordAdLead = vi.fn();
const recordApplyGate = vi.fn();

vi.mock('$env/dynamic/private', () => ({ env: { SNAP_LEAD_HMAC_SECRET: SECRET } }));

vi.mock('$lib/server/marketing-leads', async () => {
	// normalisePhone/normaliseEmail are pure and already covered by their own
	// tests, so the real ones run here — the mapping from Snap's fields to them is
	// exactly what this file is checking.
	const actual = await vi.importActual<typeof import('$lib/server/marketing-leads')>(
		'$lib/server/marketing-leads'
	);
	return { ...actual, recordAdLead };
});

vi.mock('$lib/server/apply-gate', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/apply-gate')>(
		'$lib/server/apply-gate'
	);
	return { ...actual, recordApplyGate };
});

const { POST } = await import('./+server');

const TS = '1788015850';

/** Snap signs `{timestamp}.{body}`, not the body alone. */
function sign(body: string, secret = SECRET, ts = TS): string {
	return createHmac('sha256', secret).update(`${ts}.${body}`, 'utf8').digest('hex');
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
		// `t` unless a test overrides it — every real delivery carries one.
		headers: { t: TS, ...headers }
	});
	return POST({ request } as never);
}

beforeEach(() => {
	vi.clearAllMocks();
	recordAdLead.mockResolvedValue({ ok: true, duplicate: false });
	recordApplyGate.mockResolvedValue({ ok: true });
});

describe('signature gate', () => {
	it('accepts a correctly signed body', async () => {
		const body = payload();
		const res = await call(body, { 'signature': sign(body) });
		expect(res.status).toBe(200);
		expect(recordAdLead).toHaveBeenCalledOnce();
	});

	it('rejects a body with no signature header and writes nothing', async () => {
		const res = await call(payload(), {});
		expect(res.status).toBe(401);
		expect(recordAdLead).not.toHaveBeenCalled();
	});

	it('rejects a signature computed with the wrong secret', async () => {
		const body = payload();
		const res = await call(body, { 'signature': sign(body, 'not-the-secret') });
		expect(res.status).toBe(401);
		expect(recordAdLead).not.toHaveBeenCalled();
	});

	it('rejects a body altered after signing', async () => {
		// The whole point of signing the raw bytes: a tampered payload must not
		// validate against the signature of the original.
		const signature = sign(payload());
		const tampered = payload({ phone_number: '+91 99999 99999' });
		const res = await call(tampered, { 'signature': signature });
		expect(res.status).toBe(401);
		expect(recordAdLead).not.toHaveBeenCalled();
	});

	it('signs {timestamp}.{body}, not the body alone', async () => {
		// The bug the first live delivery found. Signing only the body produces a
		// well-formed hex string that never matches, and the failure looks exactly
		// like a wrong secret.
		const body = payload();
		const bodyOnly = createHmac('sha256', SECRET).update(body, 'utf8').digest('hex');
		const res = await call(body, { signature: bodyOnly });
		expect(res.status).toBe(401);
		expect(recordAdLead).not.toHaveBeenCalled();
	});

	it('rejects a signature computed with a different timestamp', async () => {
		// The timestamp is inside the signed message, so it cannot be swapped.
		const body = payload();
		const res = await call(body, { signature: sign(body, SECRET, '1700000000') });
		expect(res.status).toBe(401);
	});

	it('rejects a delivery with no timestamp header', async () => {
		const body = payload();
		const request = new Request('https://x.example/api/marketing/snap-lead', {
			method: 'POST',
			body,
			headers: { signature: sign(body) }
		});
		const res = await POST({ request } as never);
		expect(res.status).toBe(401);
		expect(recordAdLead).not.toHaveBeenCalled();
	});

	it('accepts an old timestamp — a retry must not expire', async () => {
		// No freshness window on purpose: Snap retries, and rejecting a late retry
		// loses the lead. Replay is inert because snap_lead_id is unique.
		const body = payload();
		const old = '1600000000';
		const res = await call(body, { signature: sign(body, SECRET, old), t: old });
		expect(res.status).toBe(200);
	});

	it('rejects a malformed signature without throwing a 500', async () => {
		// timingSafeEqual throws on a length mismatch. If that escaped, a junk
		// header would become a 500 and Snap would retry it forever.
		const body = payload();
		for (const bad of ['', 'zz', 'not-hex-at-all', sign(body).slice(0, 20)]) {
			const res = await call(body, { 'signature': bad });
			expect(res.status, bad).toBe(401);
		}
	});

	it('accepts the sha256= prefix form and is case-insensitive', async () => {
		const body = payload();
		const res = await call(body, { 'signature': `sha256=${sign(body).toUpperCase()}` });
		expect(res.status).toBe(200);
	});
});

describe('under-18 handling', () => {
	it('records a suppression row and never a lead', async () => {
		const body = payload({ birthday: '2012-01-01' });
		const res = await call(body, { 'signature': sign(body) });

		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ stored: false, reason: 'under_18' });
		// The assertion this file exists for.
		expect(recordAdLead).not.toHaveBeenCalled();
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
		const res = await call(body, { 'signature': sign(body) });
		expect(res.status).toBe(200);
		expect(recordAdLead).toHaveBeenCalledOnce();
		expect(recordApplyGate).not.toHaveBeenCalled();
	});

	it('stores the lead when no birthday was collected', async () => {
		// The common case. "Unknown age" is not "minor" — the downstream gate is
		// what covers it — but it must not silently drop the lead either.
		const body = payload();
		await call(body, { 'signature': sign(body) });
		expect(recordAdLead).toHaveBeenCalledOnce();
		expect(recordApplyGate).not.toHaveBeenCalled();
	});

	it('answers 500 when the suppression row cannot be written', async () => {
		// Losing the suppression record is worse than a duplicate one: it is the
		// only trace that this lead must be pulled from the Ads Manager export.
		recordApplyGate.mockResolvedValue({ ok: false, reason: 'boom' });
		const body = payload({ birthday: '2012-01-01' });
		const res = await call(body, { 'signature': sign(body) });
		expect(res.status).toBe(500);
	});
});

describe('synthetic test payloads', () => {
	// The regression for 2026-08-29: a `snap-leads test` delivery wrote a real row
	// into the contact list. It is signed with the real secret and structurally
	// valid, so nothing upstream can catch it.
	it('ignores the sample payload by campaign name', async () => {
		const body = payload({ campaign_name: 'Snap Test Campaign Name' });
		const res = await call(body, { signature: sign(body) });
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ stored: false, reason: 'test_payload' });
		expect(recordAdLead).not.toHaveBeenCalled();
	});

	it('ignores it by @snapchat.com email', async () => {
		const body = payload({ email: 'johndoe@snapchat.com' });
		const res = await call(body, { signature: sign(body) });
		expect(res.status).toBe(200);
		expect(recordAdLead).not.toHaveBeenCalled();
	});

	it('ignores it by the sample first name', async () => {
		const body = payload({ first_name: 'Sample Lead First Name' });
		const res = await call(body, { signature: sign(body) });
		expect(res.status).toBe(200);
		expect(recordAdLead).not.toHaveBeenCalled();
	});

	it('never writes a suppression row for a synthetic under-18 lead', async () => {
		// A fake person must not land in marketing_apply_gate either.
		const body = payload({ campaign_name: 'Snap Test Campaign Name', birthday: '2012-01-01' });
		await call(body, { signature: sign(body) });
		expect(recordApplyGate).not.toHaveBeenCalled();
		expect(recordAdLead).not.toHaveBeenCalled();
	});

	it('still stores a real lead that merely mentions test elsewhere', async () => {
		// The guard keys on Snap's fixed sample values, not on the word "test"
		// appearing anywhere — a real campaign called RA_LEADS_AB_TEST must survive.
		const body = payload({ campaign_name: 'RA_LEADS_AB_TEST_20260829' });
		const res = await call(body, { signature: sign(body) });
		expect(res.status).toBe(200);
		expect(recordAdLead).toHaveBeenCalledOnce();
	});
});

describe('field mapping', () => {
	it('normalises the contact and marks the kind as phone, not whatsapp', async () => {
		const body = payload();
		await call(body, { 'signature': sign(body) });

		const [lead] = recordAdLead.mock.calls[0];
		expect(lead.whatsappE164).toBe('+919876543210');
		expect(lead.email).toBe('her@example.com');
		expect(lead.adLeadId).toBe('lead-abc-123');
		expect(lead.submittedAt).toBe('2026-08-29T10:00:00Z');
		expect(lead.adGroupName).toBe('SC_F_LEADS_W_1830');
	});

	it('derives audience from the F/M marker in the ad squad name', async () => {
		const body = payload();
		await call(body, { 'signature': sign(body) });
		expect(recordAdLead.mock.calls[0][0].audience).toBe('woman');
	});

	it('reads space-separated names, not just underscore-separated ones', async () => {
		// The live account mixes conventions: "Female College" and "Female Leads"
		// are real ad squad and campaign names alongside SC_F_19-30_India.
		const body = payload({
			ad_squad_name: 'Female College',
			campaign_name: 'Female Leads',
			ad_name: 'Female Leads'
		});
		await call(body, { 'signature': sign(body) });
		expect(recordAdLead.mock.calls[0][0].audience).toBe('woman');
	});

	it('does not read WOMEN as MEN', async () => {
		// WOMEN_18-35_CASUAL_STORY_IND_LEADS is a real squad. If the man pattern
		// matched the MEN inside WOMEN, every female lead would be mislabelled.
		const body = payload({
			ad_squad_name: 'WOMEN_18-35_CASUAL_STORY_IND_LEADS',
			campaign_name: 'RA_LEADS_CASUAL_WOMEN_TOF_20260815',
			ad_name: 'RA_LEADS_AD'
		});
		await call(body, { 'signature': sign(body) });
		expect(recordAdLead.mock.calls[0][0].audience).toBe('woman');
	});

	it('leaves audience null rather than guessing when the names say nothing', async () => {
		// A wrong guess here silently mis-segments every report grouped by audience,
		// which is worse than an honest null.
		const body = payload({
			ad_squad_name: 'SC_LEADS_TOF',
			campaign_name: 'SC_LEADS_TOF',
			ad_name: 'SC_LEADS_AD'
		});
		await call(body, { 'signature': sign(body) });
		expect(recordAdLead.mock.calls[0][0].audience).toBeNull();
	});

	it('drops an unusable contact with a 200 so it is not retried forever', async () => {
		// A non-Indian number normalisePhone rejects by design. Redelivery would
		// produce exactly the same result, so there is nothing to retry.
		const body = payload({ phone_number: '+44 7700 900123', email: null });
		const res = await call(body, { 'signature': sign(body) });
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ stored: false, reason: 'no_usable_contact' });
		expect(recordAdLead).not.toHaveBeenCalled();
	});
});

describe('retry semantics', () => {
	it('answers 200 to a redelivered lead so Snap stops retrying', async () => {
		recordAdLead.mockResolvedValue({ ok: true, duplicate: true });
		const body = payload();
		const res = await call(body, { 'signature': sign(body) });
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ ok: true, stored: false });
	});

	it('answers 500 on a write failure so the retry is the second chance', async () => {
		recordAdLead.mockResolvedValue({ ok: false, reason: 'transient' });
		const body = payload();
		const res = await call(body, { 'signature': sign(body) });
		expect(res.status).toBe(500);
	});

	it('answers 400 to an authenticated body that is not JSON', async () => {
		// Authenticated but unparseable — retrying cannot fix it.
		const body = 'not json at all';
		const res = await call(body, { 'signature': sign(body) });
		expect(res.status).toBe(400);
	});

	it('answers 400 to an authenticated payload with no lead_id', async () => {
		const body = JSON.stringify({ form_id: 'form-1', phone_number: '9876543210' });
		const res = await call(body, { 'signature': sign(body) });
		expect(res.status).toBe(400);
		expect(recordAdLead).not.toHaveBeenCalled();
	});
});
