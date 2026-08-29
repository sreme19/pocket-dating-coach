import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';

/**
 * Meta's leadgen webhook.
 *
 * The Snap receiver's tests pin the same two invariants — an unsigned body must
 * never write, and an under-18 lead must never write contact details. What is
 * genuinely different here, and what most of this file is about, is that the
 * webhook does NOT carry the lead. It carries an id, and the fields are a second
 * Graph call away. So a delivery can fail for reasons unrelated to the delivery,
 * and which of those answer 500 (retry) versus 200 (stop) decides whether a
 * missing permission loses leads permanently or merely delays them.
 */

const SECRET = 'test-app-secret';
const VERIFY = 'test-verify-token';

const recordAdLead = vi.fn();
const recordApplyGate = vi.fn();
const fetchLead = vi.fn();
const pageToken = vi.fn();

vi.mock('$env/dynamic/private', () => ({
	env: {
		META_APP_SECRET: SECRET,
		META_LEAD_VERIFY_TOKEN: VERIFY,
		META_PAGE_ID: '123',
		META_MARKETING_TOKEN: 'tok'
	}
}));

vi.mock('$lib/server/marketing-leads', async () => {
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

vi.mock('$lib/server/meta-leads', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/meta-leads')>(
		'$lib/server/meta-leads'
	);
	// toAdLead / isMinor / audienceFromNames are pure and stay real — the mapping
	// from Meta's field_data is exactly what these tests are checking.
	return { ...actual, fetchLead, pageToken, resolveNames: vi.fn() };
});

const { POST, GET } = await import('./+server');

function sign(body: string, secret = SECRET): string {
	return 'sha256=' + createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

function hook(...leadIds: string[]) {
	return JSON.stringify({
		object: 'page',
		entry: [
			{
				id: '123',
				changes: leadIds.map((id) => ({ field: 'leadgen', value: { leadgen_id: id } }))
			}
		]
	});
}

function lead(extra: Record<string, unknown> = {}) {
	return {
		id: 'lead-1',
		created_time: '2026-08-29T10:00:00+0000',
		ad_id: 'ad-1',
		adset_id: 'adset-1',
		campaign_id: 'camp-1',
		form_id: 'form-1',
		field_data: [
			{ name: 'full_name', values: ['Asha Rao'] },
			{ name: 'phone_number', values: ['+91 98765 43210'] },
			{ name: 'email', values: ['Her@Example.COM'] }
		],
		...extra
	};
}

function call(body: string, headers: Record<string, string>) {
	const request = new Request('https://x.example/api/marketing/meta-lead', {
		method: 'POST',
		body,
		headers
	});
	return POST({ request } as never);
}

beforeEach(() => {
	vi.clearAllMocks();
	recordAdLead.mockResolvedValue({ ok: true, duplicate: false });
	recordApplyGate.mockResolvedValue({ ok: true });
	pageToken.mockResolvedValue('page-token');
	fetchLead.mockResolvedValue(lead());
});

describe('subscription handshake', () => {
	it('echoes the challenge as bare text when the verify token matches', async () => {
		const url = new URL(
			`https://x.example/api/marketing/meta-lead?hub.mode=subscribe&hub.verify_token=${VERIFY}&hub.challenge=abc123`
		);
		const res = await GET({ url } as never);
		expect(res.status).toBe(200);
		// Bare, unquoted — Meta rejects JSON here.
		expect(await res.text()).toBe('abc123');
	});

	it('refuses a wrong verify token', async () => {
		const url = new URL(
			'https://x.example/api/marketing/meta-lead?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc'
		);
		const res = await GET({ url } as never);
		expect(res.status).toBe(403);
	});
});

describe('signature gate', () => {
	it('accepts a correctly signed delivery', async () => {
		const body = hook('lead-1');
		const res = await call(body, { 'x-hub-signature-256': sign(body) });
		expect(res.status).toBe(200);
		expect(recordAdLead).toHaveBeenCalledOnce();
	});

	it('rejects an unsigned delivery and fetches nothing', async () => {
		const res = await call(hook('lead-1'), {});
		expect(res.status).toBe(401);
		// The important half: no Graph call, so no lead data is even retrieved.
		expect(fetchLead).not.toHaveBeenCalled();
		expect(recordAdLead).not.toHaveBeenCalled();
	});

	it('rejects a signature from the wrong secret', async () => {
		const body = hook('lead-1');
		const res = await call(body, { 'x-hub-signature-256': sign(body, 'nope') });
		expect(res.status).toBe(401);
	});

	it('rejects a body altered after signing', async () => {
		const signature = sign(hook('lead-1'));
		const res = await call(hook('lead-666'), { 'x-hub-signature-256': signature });
		expect(res.status).toBe(401);
	});

	it('rejects a malformed signature without a 500', async () => {
		const body = hook('lead-1');
		for (const bad of ['', 'sha256=zz', 'garbage']) {
			const res = await call(body, { 'x-hub-signature-256': bad });
			expect(res.status, bad).toBe(401);
		}
	});
});

describe('the second call', () => {
	it('answers 500 when lead retrieval fails, so Meta retries', async () => {
		// This is the leads_retrieval case. It MUST be retryable: granting the
		// permission later has to make the redelivery succeed, or the lead is
		// lost for a reason that was fixable.
		fetchLead.mockRejectedValue(new Error('(#200) Requires leads_retrieval permission'));
		const body = hook('lead-1');
		const res = await call(body, { 'x-hub-signature-256': sign(body) });
		expect(res.status).toBe(500);
		expect(recordAdLead).not.toHaveBeenCalled();
	});

	it('answers 500 when no page token can be obtained', async () => {
		pageToken.mockRejectedValue(new Error('page not assigned'));
		const body = hook('lead-1');
		const res = await call(body, { 'x-hub-signature-256': sign(body) });
		expect(res.status).toBe(500);
	});

	it('handles a batch carrying several leads', async () => {
		fetchLead
			.mockResolvedValueOnce(lead({ id: 'lead-1' }))
			.mockResolvedValueOnce(lead({ id: 'lead-2' }));
		const body = hook('lead-1', 'lead-2');
		const res = await call(body, { 'x-hub-signature-256': sign(body) });
		expect(res.status).toBe(200);
		expect(recordAdLead).toHaveBeenCalledTimes(2);
	});

	it('ignores changes that are not leadgen', async () => {
		const body = JSON.stringify({
			entry: [{ changes: [{ field: 'feed', value: { post_id: 'x' } }] }]
		});
		const res = await call(body, { 'x-hub-signature-256': sign(body) });
		expect(res.status).toBe(200);
		expect(fetchLead).not.toHaveBeenCalled();
	});
});

describe('field mapping and safety', () => {
	it('normalises the contact and splits full_name', async () => {
		const body = hook('lead-1');
		await call(body, { 'x-hub-signature-256': sign(body) });
		const [mapped] = recordAdLead.mock.calls[0];
		expect(mapped.network).toBe('meta_lead_form');
		expect(mapped.whatsappE164).toBe('+919876543210');
		expect(mapped.email).toBe('her@example.com');
		expect(mapped.firstName).toBe('Asha');
		expect(mapped.lastName).toBe('Rao');
	});

	it('never stores contact details for an under-18 lead', async () => {
		fetchLead.mockResolvedValue(lead({ field_data: [
			{ name: 'full_name', values: ['Asha Rao'] },
			{ name: 'phone_number', values: ['+919876543210'] },
			{ name: 'date_of_birth', values: ['2012-01-01'] }
		] }));
		const body = hook('lead-1');
		const res = await call(body, { 'x-hub-signature-256': sign(body) });
		expect(res.status).toBe(200);
		expect(recordAdLead).not.toHaveBeenCalled();
		expect(recordApplyGate).toHaveBeenCalledOnce();
		const [gate] = recordApplyGate.mock.calls[0];
		expect(JSON.stringify(gate)).not.toContain('98765');
		expect(JSON.stringify(gate)).not.toContain('Asha');
	});

	it('skips a lead with no usable contact without failing the batch', async () => {
		fetchLead.mockResolvedValue(lead({ field_data: [{ name: 'full_name', values: ['X'] }] }));
		const body = hook('lead-1');
		const res = await call(body, { 'x-hub-signature-256': sign(body) });
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ skipped: 1, stored: 0 });
	});

	it('answers 500 when the write fails, so the retry is the second chance', async () => {
		recordAdLead.mockResolvedValue({ ok: false, reason: 'transient' });
		const body = hook('lead-1');
		const res = await call(body, { 'x-hub-signature-256': sign(body) });
		expect(res.status).toBe(500);
	});

	it('answers 200 to a duplicate so redelivery stops', async () => {
		recordAdLead.mockResolvedValue({ ok: true, duplicate: true });
		const body = hook('lead-1');
		const res = await call(body, { 'x-hub-signature-256': sign(body) });
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ stored: 0 });
	});
});
