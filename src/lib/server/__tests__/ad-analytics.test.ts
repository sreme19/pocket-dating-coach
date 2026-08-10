import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * These tests exist for one bug in particular.
 *
 * buildAdAnalytics over-fetches by a day on each side of the range, because an
 * IST day starts 5h30m before the UTC one and a naive UTC window drops rows
 * that belong in the first bucket. For a long time that slack was never trimmed,
 * so every count below the trends — the campaign leaderboard, the visit funnel,
 * the CTA split, the health totals — silently included up to a day of events
 * from outside the requested range. Nothing looked wrong, because everything
 * inflated together and the page stayed self-consistent while disagreeing with
 * the dates printed at the top of it.
 *
 * The fixture below deliberately puts rows on both sides of the boundary and on
 * the boundary itself, so a regression shows up as a number rather than as a
 * crash.
 */

const rows: Record<string, any[]> = {};

vi.mock('$lib/server/supabase', () => ({
	getSupabase: () => {
		const build = (table: string) => {
			const q: any = {
				select: () => q,
				gte: () => q,
				lte: () => q,
				then: (resolve: any) => resolve({ data: rows[table] ?? [], error: null })
			};
			return q;
		};
		return { from: (table: string) => build(table) };
	}
}));

const { buildAdAnalytics } = await import('../ad-analytics');

/** 18:30Z is exactly 00:00 IST the following day — the boundary that matters. */
const V = (iso: string, campaign = 'c1', visit = null as string | null) => ({
	created_at: iso,
	page: 'get',
	campaign,
	country: 'IN',
	user_agent: 'x',
	utm: {},
	visit_id: visit
});

beforeEach(() => {
	for (const k of Object.keys(rows)) delete rows[k];
	rows.ad_spend_daily = [];
	rows.ad_fx_rates = [];
	rows.user_acquisition = [];
	rows.verified_vibe_users = [];
	rows.aibestie_lp_sessions = [];
	rows.marketing_store_clicks = [];
	rows.marketing_page_views = [];
});

const RANGE = { start: '2026-08-10', end: '2026-08-10', currency: 'INR' as const };

describe('the over-fetch slack is trimmed, not counted', () => {
	it('drops rows from the day before and the day after the IST range', async () => {
		rows.marketing_page_views = [
			V('2026-08-09T18:29:59.000Z'), // 23:59:59 IST on the 9th — OUT
			V('2026-08-09T18:30:00.000Z'), // 00:00 IST on the 10th — IN
			V('2026-08-10T07:17:00.000Z'), // 12:47 IST on the 10th — IN
			V('2026-08-10T18:29:00.000Z'), // 23:59 IST on the 10th — IN
			V('2026-08-10T18:30:00.000Z') // 00:00 IST on the 11th — OUT
		];

		const d = await buildAdAnalytics({ ...RANGE, granularity: 'day' });

		expect(d.trends.views).toEqual({ '2026-08-10': 3 });
		// The health panel counts raw rows; it must see the trimmed set too.
		expect(d.health.counts.views).toBe(3);
		// So must the campaign leaderboard.
		expect(d.leaderboard.find((c: any) => c.campaign === 'c1')?.views).toBe(3);
	});

	it('never invents a bucket outside the range', async () => {
		rows.marketing_page_views = [
			V('2026-08-09T18:00:00.000Z'), // 23:30 IST on the 9th — OUT
			V('2026-08-10T07:17:00.000Z')
		];

		for (const [g, expected] of [
			['day', 1],
			['hour', 24],
			['quarter', 96],
			['minute', 1440]
		] as const) {
			const d = await buildAdAnalytics({ ...RANGE, granularity: g });
			// Exactly the zero-filled buckets, with nothing appended by an
			// out-of-range event landing on a key the chart never draws.
			expect(Object.keys(d.trends.views), g).toHaveLength(expected);
			expect(d.range.buckets, g).toBe(expected);
			expect(Object.values(d.trends.views).reduce((a: number, b: number) => a + b, 0), g).toBe(1);
		}
	});
});

describe('re-bucketing conserves events', () => {
	it('gives the same totals at every granularity', async () => {
		rows.marketing_page_views = [
			V('2026-08-09T18:30:00.000Z'),
			V('2026-08-10T00:00:00.000Z'),
			V('2026-08-10T07:17:00.000Z'),
			V('2026-08-10T07:17:30.000Z'),
			V('2026-08-10T18:29:00.000Z')
		];

		const sums: number[] = [];
		for (const g of ['day', 'hour', 'quarter', 'minute'] as const) {
			const d = await buildAdAnalytics({ ...RANGE, granularity: g });
			sums.push(Object.values(d.trends.views).reduce((a: number, b: number) => a + b, 0));
		}
		expect(sums).toEqual([5, 5, 5, 5]);
	});

	it('buckets by the Kolkata clock, not the UTC one', async () => {
		// 07:17 UTC is 12:47 IST. An hourly chart must file this under 12, not 07 —
		// bucketing by UTC is the distortion the whole module exists to avoid.
		rows.marketing_page_views = [V('2026-08-10T07:17:00.000Z')];

		const d = await buildAdAnalytics({ ...RANGE, granularity: 'hour' });
		expect(d.trends.views['2026-08-10T12:00']).toBe(1);
		expect(d.trends.views['2026-08-10T07:00']).toBe(0);
	});
});

describe('spend stays day-keyed at every granularity', () => {
	it('does not split a daily total across sub-daily buckets', async () => {
		rows.marketing_page_views = [V('2026-08-10T07:17:00.000Z')];
		rows.ad_spend_daily = [
			{
				network: 'snap',
				date: '2026-08-10',
				campaign_id: 'x',
				campaign_name: 'c1',
				ad_set_id: '',
				creative_id: '',
				spend: '480',
				currency: 'INR',
				impressions: 1000,
				clicks: 10,
				network_conversions: 0,
				fetched_at: '2026-08-10T01:00:00.000Z'
			}
		];

		const hourly = await buildAdAnalytics({ ...RANGE, granularity: 'hour' });
		// 24 view buckets, but spend is a single day — never 480/24 per hour.
		expect(Object.keys(hourly.trends.views)).toHaveLength(24);
		expect(hourly.spendDaily).toEqual({ '2026-08-10': 480 });
		expect((hourly as any).trends.spend).toBeUndefined();
	});
});

describe('burst detection', () => {
	const many = (n: number, iso: string) => Array.from({ length: n }, () => V(iso));

	it('flags a minute holding a large share of the range', async () => {
		rows.marketing_page_views = [
			...many(72, '2026-08-10T07:17:00.000Z'),
			...many(30, '2026-08-10T02:00:00.000Z')
		];

		const d = await buildAdAnalytics({ ...RANGE, granularity: 'day' });
		expect(d.burst).toMatchObject({ at: '2026-08-10T12:47', views: 72 });
		expect(d.anomalies.join(' ')).toContain('2026-08-10T12:47');
	});

	it('is found at day granularity too — the bucket size must not hide it', async () => {
		rows.marketing_page_views = many(40, '2026-08-10T07:17:00.000Z');
		const d = await buildAdAnalytics({ ...RANGE, granularity: 'day' });
		expect(d.burst?.views).toBe(40);
	});

	it('stays quiet on a quiet range, where a shared minute means nothing', async () => {
		// 3 of 4 views in one minute is a 75% share, but 3 views is not a burst.
		rows.marketing_page_views = [
			...many(3, '2026-08-10T07:17:00.000Z'),
			V('2026-08-10T02:00:00.000Z')
		];
		const d = await buildAdAnalytics({ ...RANGE, granularity: 'day' });
		expect(d.burst).toBeNull();
	});

	it('stays quiet when a busy minute is a small share of a busy range', async () => {
		// 15 in one minute is over the count threshold, but spread the other 200
		// across distinct minutes and no single minute holds a fifth of the day.
		rows.marketing_page_views = [
			...many(15, '2026-08-10T07:17:00.000Z'),
			...Array.from({ length: 200 }, (_, i) =>
				V(`2026-08-10T02:${String(i % 60).padStart(2, '0')}:00.000Z`)
			)
		];
		const d = await buildAdAnalytics({ ...RANGE, granularity: 'day' });
		expect(d.burst).toBeNull();
	});

	it('is null on an empty range rather than dividing by zero', async () => {
		const d = await buildAdAnalytics({ ...RANGE, granularity: 'day' });
		expect(d.burst).toBeNull();
		expect(Number.isNaN(d.visitFunnel.tapRate as number)).toBe(false);
	});
});
