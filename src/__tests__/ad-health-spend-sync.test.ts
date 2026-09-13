import { describe, it, expect } from 'vitest';
import { spendSyncFinding, type SyncRunRecord } from '$lib/server/ad-health';

const NOW = new Date('2026-09-13T06:45:00Z');
const GOOD_CREDS = { token: true, adAccountId: true };

/** A run that happened 25 minutes ago and returned nothing, without erroring. */
const healthyEmptyRun: SyncRunRecord = {
	network: 'meta',
	ran_at: '2026-09-13T06:20:31Z',
	rows_returned: 0,
	error: null,
};

const base = {
	network: 'meta' as const,
	credentials: GOOD_CREDS,
	run: healthyEmptyRun,
	runsReadable: true,
	lastDeliveryDate: '2026-09-08',
	now: NOW,
};

describe('the case that produced the false alarm on 2026-09-13', () => {
	it('says NOTHING when the sync ran fine and the campaigns are simply paused', () => {
		// Real numbers from that morning: last Meta delivery 8 Sep, sync ran
		// successfully at 06:20, alert fired at 06:45 calling it broken.
		expect(spendSyncFinding(base)).toBeNull();
	});

	it('still says nothing when the network has never delivered at all', () => {
		expect(spendSyncFinding({ ...base, lastDeliveryDate: null })).toBeNull();
	});
});

describe('what it does flag', () => {
	it('reports a total API failure as broken, quoting it', () => {
		const f = spendSyncFinding({
			...base,
			run: { ...healthyEmptyRun, rows_returned: 0, error: 'insights 400 — access token expired or revoked: {"code":190}' },
		});
		expect(f?.severity).toBe('broken');
		expect(f?.title).toBe('meta spend sync is failing');
		expect(f?.detail).toContain('code":190');
		expect(f?.detail).toContain('reads as zero');
	});

	it('reports a stopped job as broken once it is hours late', () => {
		const f = spendSyncFinding({
			...base,
			run: { ...healthyEmptyRun, ran_at: '2026-09-13T00:20:00Z' }, // 6.4h earlier
		});
		expect(f?.severity).toBe('broken');
		expect(f?.title).toBe('meta spend sync has stopped running');
		expect(f?.detail).toContain('6h ago');
	});

	it('does not call a merely recent run stale', () => {
		expect(spendSyncFinding({
			...base,
			run: { ...healthyEmptyRun, ran_at: '2026-09-13T04:00:00Z' }, // 2.75h
		})).toBeNull();
	});

	it('reports missing credentials as pending, not broken, naming what is absent', () => {
		const f = spendSyncFinding({ ...base, credentials: { token: true, adAccountId: false } });
		expect(f?.severity).toBe('pending');
		expect(f?.detail).toContain('adAccountId');
		expect(f?.detail).not.toContain('token,');
	});

	it('admits it cannot tell when the run record is missing entirely', () => {
		const f = spendSyncFinding({ ...base, run: null });
		expect(f?.severity).toBe('pending');
		expect(f?.title).toContain('not being recorded');
	});

	it('admits it cannot tell when ad_sync_runs is unreadable', () => {
		const f = spendSyncFinding({ ...base, runsReadable: false });
		expect(f?.severity).toBe('pending');
	});

	it('never reports an unreadable timestamp as healthy', () => {
		const f = spendSyncFinding({ ...base, run: { ...healthyEmptyRun, ran_at: 'not-a-date' } });
		expect(f?.severity).toBe('broken');
	});
});

describe('precedence — the most actionable cause wins', () => {
	it('names the missing credential rather than the absent run record', () => {
		const f = spendSyncFinding({
			...base,
			credentials: { token: false, adAccountId: true },
			run: null,
		});
		expect(f?.title).toContain('not configured');
	});

	it('names the API error rather than the staleness it causes', () => {
		const f = spendSyncFinding({
			...base,
			run: { ...healthyEmptyRun, ran_at: '2026-09-12T00:00:00Z', error: 'insights 400: bad request' },
		});
		expect(f?.title).toContain('is failing');
	});
});

describe('partial failure is not total failure', () => {
	// The real 08:20 run on 2026-09-13: Snap rate-limited 11 ad squads with 429
	// while 91 rows landed fine. Calling that a dead pipeline is false.
	// Verbatim from ad_sync_runs after the live 08:20 run — including the
	// <meta tag truncated mid-attribute by snap.ts's own slice, which an
	// invented test string did not have and which defeated the first
	// version of condenseError.
	const SNAP_429 =
		'11 ad squad(s) failed: GET_ID_M_2840_ANDROID: 429 <html>\n<head>\n<meta http-equiv="Content-Type" content="text/html;charset=ISO-885 | WOMEN_18-30_CASUAL_MOVEON-STORY: 429 <html>\n<head>\n<meta http-equiv="Content-Type" content="text/html;charset=ISO-885 | Women_18-3';

	const partial = {
		...base,
		network: 'snap' as const,
		run: { network: 'snap', ran_at: '2026-09-13T08:20:38Z', rows_returned: 91, error: SNAP_429 },
	};

	it('is a warning, not broken, when rows came back alongside the error', () => {
		const f = spendSyncFinding(partial);
		expect(f?.severity).toBe('warning');
		expect(f?.title).toBe('snap spend sync is partly failing');
	});

	it('says the spend is understated, and never that it reads as zero', () => {
		const f = spendSyncFinding(partial);
		expect(f?.detail).toContain('91 rows');
		expect(f?.detail).toContain('understated');
		expect(f?.detail).not.toContain('reads as zero');
	});

	it('condenses the HTML error page into one readable line', () => {
		const d = spendSyncFinding(partial)!.detail;
		expect(d).not.toContain('<');
		expect(d).not.toContain('\n');
		expect(d).not.toContain('http-equiv');
		expect(d).toContain('429');
		expect(d).toContain('11 ad squad(s) failed');
	});

	it('keeps every ad squad name the error listed', () => {
		const d = spendSyncFinding(partial)!.detail;
		expect(d).toContain('GET_ID_M_2840_ANDROID');
		expect(d).toContain('WOMEN_18-30_CASUAL_MOVEON-STORY');
	});

	it('treats an absent row count as a total failure rather than assuming success', () => {
		const f = spendSyncFinding({
			...partial,
			run: { network: 'snap', ran_at: '2026-09-13T08:20:38Z', error: SNAP_429 },
		});
		expect(f?.severity).toBe('broken');
	});
});
