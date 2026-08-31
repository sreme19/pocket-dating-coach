import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * The Snap sheet-sync endpoint.
 *
 * Three things must never be wrong, and they are why this file exists:
 *   1. An unauthenticated body must never write a row. The transport is a plain
 *      shared secret; if the check is weak, an unauthenticated caller reaches a
 *      contact list.
 *   2. A synthetic test row must never become a person. Snap's sample lead and
 *      its "Test:"-prefixed template row both arrive in the sheet looking real.
 *   3. Every delivered row must be counted in marketing_lead_submissions, so the
 *      daily readout can reconcile against Ads Manager rather than trust a
 *      silently-deduped DB count.
 *
 * The mapping from sheet columns to recordAdLead is checked with the real
 * normalisers (they are pure and separately tested); only the two DB writes are
 * mocked.
 */

const SECRET = 'test-sync-secret';

const recordAdLead = vi.fn();
const recordLeadSubmission = vi.fn();

vi.mock('$env/dynamic/private', () => ({ env: { SNAP_SHEET_SYNC_SECRET: SECRET } }));

vi.mock('$lib/server/marketing-leads', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/marketing-leads')>(
		'$lib/server/marketing-leads'
	);
	return { ...actual, recordAdLead, recordLeadSubmission };
});

const { POST } = await import('./+server');

function req(bodyObj: unknown, headers: Record<string, string> = { 'x-sync-secret': SECRET }) {
	const raw = JSON.stringify(bodyObj);
	return new Request('https://www.riteangle.dating/api/marketing/snap-sheet-sync', {
		method: 'POST',
		headers: { 'content-type': 'application/json', ...headers },
		body: raw
	});
}

function realLead(extra: Record<string, unknown> = {}) {
	return {
		formId: '1897accc-cd6b-4f60-9269-d76ec149842d',
		formName: 'RA_LEAD_WOMEN_18-30_CASUAL_MOVEON-LEAD_SNAP',
		campaignId: '1326aa05-902c-4cec-be92-0a7440ac536d',
		campaignName: 'RA_LEADS_GETW-APPLY_IN_PAN_TOF_202608',
		adId: '3c9d2884-b6e3-4137-98ed-2bfcb5f236d4',
		adName: 'VID_MOVE-ON-PROPER_A_20260829',
		adSquadId: '85c2e782-ea07-4216-8986-f272bdb5d4d7',
		adSquadName: 'WOMEN_18-30_CASUAL_MOVEON-LEAD',
		leadId: 'lead-real-1',
		createTime: '2026-08-30T12:27:53.523Z',
		firstName: 'Muskan',
		lastName: 'Rana',
		email: 'ranag28787@gmail.com',
		phoneNumber: '+918307732453',
		leadStatus: 'INTAKE',
		...extra
	};
}

beforeEach(() => {
	recordAdLead.mockReset();
	recordLeadSubmission.mockReset();
	recordAdLead.mockResolvedValue({ ok: true, duplicate: false });
	recordLeadSubmission.mockResolvedValue(undefined);
});

describe('auth', () => {
	it('rejects a missing secret with 401 and writes nothing', async () => {
		const res = await POST({ request: req({ rows: [realLead()] }, {}) } as never);
		expect(res.status).toBe(401);
		expect(recordAdLead).not.toHaveBeenCalled();
	});

	it('rejects a wrong secret with 401 and writes nothing', async () => {
		const res = await POST({
			request: req({ rows: [realLead()] }, { 'x-sync-secret': 'nope' })
		} as never);
		expect(res.status).toBe(401);
		expect(recordAdLead).not.toHaveBeenCalled();
	});

	it('accepts the secret via Bearer as well', async () => {
		const res = await POST({
			request: req({ rows: [realLead()] }, { authorization: `Bearer ${SECRET}` })
		} as never);
		expect(res.status).toBe(200);
		expect(recordAdLead).toHaveBeenCalledOnce();
	});
});

describe('storage & mapping', () => {
	it('stores a real lead, normalising phone to +91 E.164, and counts it', async () => {
		const res = await POST({ request: req({ rows: [realLead()] }) } as never);
		const bodyJson = await res.json();
		expect(res.status).toBe(200);
		expect(bodyJson.stored).toBe(1);

		expect(recordAdLead).toHaveBeenCalledOnce();
		const arg = recordAdLead.mock.calls[0][0];
		expect(arg.network).toBe('snap_lead_form');
		expect(arg.adLeadId).toBe('lead-real-1');
		expect(arg.whatsappE164).toBe('+918307732453');
		expect(arg.email).toBe('ranag28787@gmail.com');
		expect(arg.audience).toBe('woman'); // from WOMEN_* ad squad name

		expect(recordLeadSubmission).toHaveBeenCalledWith(
			expect.objectContaining({ adLeadId: 'lead-real-1', outcome: 'stored' })
		);
	});

	it('counts a duplicate as duplicate, not stored', async () => {
		recordAdLead.mockResolvedValue({ ok: true, duplicate: true });
		const res = await POST({ request: req({ rows: [realLead()] }) } as never);
		const bodyJson = await res.json();
		expect(bodyJson.stored).toBe(0);
		expect(bodyJson.duplicate).toBe(1);
		expect(recordLeadSubmission).toHaveBeenCalledWith(
			expect.objectContaining({ outcome: 'duplicate' })
		);
	});

	it('counts a contactless row as no_usable_contact and never stores it', async () => {
		const res = await POST({
			request: req({ rows: [realLead({ email: '', phoneNumber: '' })] })
		} as never);
		const bodyJson = await res.json();
		expect(bodyJson.no_contact).toBe(1);
		expect(recordAdLead).not.toHaveBeenCalled();
		expect(recordLeadSubmission).toHaveBeenCalledWith(
			expect.objectContaining({ outcome: 'no_usable_contact' })
		);
	});

	it('does not advance/count a row whose write failed', async () => {
		recordAdLead.mockResolvedValue({ ok: false, reason: 'boom' });
		const res = await POST({ request: req({ rows: [realLead()] }) } as never);
		const bodyJson = await res.json();
		expect(bodyJson.failed).toBe(1);
		expect(bodyJson.stored).toBe(0);
		expect(recordLeadSubmission).not.toHaveBeenCalled();
	});
});

describe('synthetic rows are never stored', () => {
	it('skips a "Test:"-prefixed template row', async () => {
		const testRow = {
			leadId: 'Test: 13cbb197-9274-401d-aa87-0482bad1a307',
			firstName: 'Test: Sample Lead First Name',
			email: 'Test: johndoe@snapchat.com',
			phoneNumber: 'Test: 555-123-4567'
		};
		const res = await POST({ request: req({ rows: [testRow] }) } as never);
		const bodyJson = await res.json();
		expect(bodyJson.test_skipped).toBe(1);
		expect(recordAdLead).not.toHaveBeenCalled();
		expect(recordLeadSubmission).not.toHaveBeenCalled();
	});

	it('skips a Snap sample lead (@snapchat.com)', async () => {
		const res = await POST({
			request: req({ rows: [realLead({ email: 'johndoe@snapchat.com', phoneNumber: '' })] })
		} as never);
		const bodyJson = await res.json();
		expect(bodyJson.test_skipped).toBe(1);
		expect(recordAdLead).not.toHaveBeenCalled();
	});
});

describe('malformed input', () => {
	it('400s when rows is not an array', async () => {
		const res = await POST({ request: req({ rows: 'nope' }) } as never);
		expect(res.status).toBe(400);
	});

	it('skips a row with no leadId without storing', async () => {
		const res = await POST({
			request: req({ rows: [realLead({ leadId: '' })] })
		} as never);
		const bodyJson = await res.json();
		expect(bodyJson.no_lead_id).toBe(1);
		expect(recordAdLead).not.toHaveBeenCalled();
	});
});
