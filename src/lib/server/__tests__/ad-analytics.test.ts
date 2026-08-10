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

describe('ad set name reconciliation', () => {
	/** A spend row with a real ad set id and the ad manager's own capitalisation. */
	const SPEND = (adSetId: string, adSetName: string, network = 'snap') => ({
		network,
		date: '2026-08-10',
		campaign_id: 'camp1',
		campaign_name: adSetName,
		ad_set_id: adSetId,
		ad_set_name: adSetName,
		creative_id: '',
		spend: '116',
		currency: 'INR',
		impressions: 5241,
		clicks: 40,
		network_conversions: 0,
		fetched_at: '2026-08-10T01:00:00.000Z'
	});

	/** A view whose utm_term never resolved, carrying only the lowercase name. */
	const UNRESOLVED = (campaign: string, source = 'snapchat') => ({
		...V('2026-08-10T07:00:00.000Z', campaign),
		user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148',
		utm: { utm_source: source, utm_campaign: campaign, utm_term: '{{adSet.id}}' }
	});

	it('merges id-less traffic into the ad set spend named, across case and separators', async () => {
		rows.ad_spend_daily = [SPEND('a1b2c3d4-1111-2222-3333-444455556666', 'MEN_25-40_CASUAL_STORY_IND-LPV')];
		rows.marketing_page_views = [
			// Resolved: carries the real id.
			{
				...V('2026-08-10T06:00:00.000Z', 'men_25_40_casual_story_ind_lpv'),
				user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148',
				utm: { utm_source: 'snapchat', utm_term: 'a1b2c3d4-1111-2222-3333-444455556666' }
			},
			UNRESOLVED('men_25_40_casual_story_ind_lpv'),
			UNRESOLVED('men_25_40_casual_story_ind_lpv')
		];

		const d = await buildAdAnalytics({ ...RANGE, granularity: 'day' });

		// ONE row for the ad set, not two near-duplicate labels.
		const forAdSet = d.leaderboard.filter((r: any) => r.adSetId === 'a1b2c3d4-1111-2222-3333-444455556666');
		expect(forAdSet).toHaveLength(1);
		expect(forAdSet[0].views).toBe(3);
		expect(forAdSet[0].spend).toBe(116);
		// The real name from spend survives, not the lowercase utm value.
		expect(forAdSet[0].campaign).toBe('MEN_25-40_CASUAL_STORY_IND-LPV');
		expect(d.leaderboard).toHaveLength(1);
	});

	it('never merges across networks, even on an identical name', async () => {
		rows.ad_spend_daily = [SPEND('meta_1', 'MEN_25-40_CASUAL_STORY_IND-LPV', 'meta')];
		rows.marketing_page_views = [UNRESOLVED('men_25_40_casual_story_ind_lpv')];

		const d = await buildAdAnalytics({ ...RANGE, granularity: 'day' });

		const meta = d.leaderboard.find((r: any) => r.adSetId === 'meta_1');
		expect(meta?.views).toBe(0);
		expect(d.traffic.viewsReconciledByName).toBe(0);
		expect(d.traffic.viewsUnattributed).toBe(1);
	});

	it('does not merge two id-less rows into each other when no spend row exists', async () => {
		rows.ad_spend_daily = [];
		rows.marketing_page_views = [
			UNRESOLVED('men_25_40_casual_story_ind_lpv'),
			UNRESOLVED('MEN_25-40_CASUAL_STORY_IND-LPV')
		];

		const d = await buildAdAnalytics({ ...RANGE, granularity: 'day' });

		// Two separate rows: nothing here has the authority to claim they are one.
		expect(d.leaderboard).toHaveLength(2);
		expect(d.traffic.viewsReconciledByName).toBe(0);
		expect(d.traffic.viewsUnattributed).toBe(2);
	});

	it('does not merge on an empty normalised name', async () => {
		rows.ad_spend_daily = [SPEND('b2c3d4e5-1111-2222-3333-444455556666', '---')];
		rows.marketing_page_views = [UNRESOLVED('___')];

		const d = await buildAdAnalytics({ ...RANGE, granularity: 'day' });
		expect(d.leaderboard.find((r: any) => r.adSetId === 'b2c3d4e5-1111-2222-3333-444455556666')?.views).toBe(0);
		expect(d.traffic.viewsReconciledByName).toBe(0);
	});

	it('keeps the two confidence buckets adding up to the old single figure', async () => {
		rows.ad_spend_daily = [SPEND('a1b2c3d4-1111-2222-3333-444455556666', 'MEN_25-40_CASUAL_STORY_IND-LPV')];
		rows.marketing_page_views = [
			UNRESOLVED('men_25_40_casual_story_ind_lpv'),
			UNRESOLVED('men_25_40_casual_story_ind_lpv'),
			UNRESOLVED('something_with_no_spend_row'),
			{
				...V('2026-08-10T06:00:00.000Z', 'x'),
				user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148',
				utm: { utm_source: 'snapchat', utm_term: 'a1b2c3d4-1111-2222-3333-444455556666' }
			}
		];

		const d = await buildAdAnalytics({ ...RANGE, granularity: 'day' });
		expect(d.traffic.viewsReconciledByName).toBe(2);
		expect(d.traffic.viewsUnattributed).toBe(1);
		expect(d.traffic.viewsWithoutAdSet).toBe(
			d.traffic.viewsReconciledByName + d.traffic.viewsUnattributed
		);
	});

	it('reconciles taps the same way, so a rate is not computed across two rows', async () => {
		rows.ad_spend_daily = [SPEND('a1b2c3d4-1111-2222-3333-444455556666', 'MEN_25-40_CASUAL_STORY_IND-LPV')];
		rows.marketing_page_views = [UNRESOLVED('men_25_40_casual_story_ind_lpv')];
		rows.marketing_store_clicks = [
			{
				created_at: '2026-08-10T07:05:00.000Z',
				page: 'get',
				cta: 'play',
				campaign: 'men_25_40_casual_story_ind_lpv',
				country: 'IN',
				visit_id: null,
				user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148',
				utm: {
					utm_source: 'snapchat',
					utm_campaign: 'men_25_40_casual_story_ind_lpv',
					utm_term: '{{adSet.id}}'
				}
			}
		];

		const d = await buildAdAnalytics({ ...RANGE, granularity: 'day' });
		const row = d.leaderboard.find((r: any) => r.adSetId === 'a1b2c3d4-1111-2222-3333-444455556666');
		expect(row?.views).toBe(1);
		expect(row?.taps).toBe(1);
		expect(d.leaderboard).toHaveLength(1);
	});
});

describe('network and audience filters', () => {
	const HIT = (campaign: string, source: string) => ({
		...V('2026-08-10T07:00:00.000Z', campaign),
		user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148',
		utm: { utm_source: source, utm_campaign: campaign }
	});

	beforeEach(() => {
		rows.marketing_page_views = [
			HIT('men_25_40_casual_story_ind_lpv', 'snapchat'),
			HIT('men_25_40_casual_story_ind_lpv', 'snapchat'),
			HIT('women_18_30_blr_lifestyle_auto', 'snapchat'),
			HIT('6978093820881', 'ig')
		];
	});

	it('filters views by network', async () => {
		const snap = await buildAdAnalytics({ ...RANGE, granularity: 'day', network: 'snap' });
		const meta = await buildAdAnalytics({ ...RANGE, granularity: 'day', network: 'meta' });
		expect(snap.health.counts.views).toBe(3);
		expect(meta.health.counts.views).toBe(1);
	});

	it('filters views by targeted audience', async () => {
		const men = await buildAdAnalytics({ ...RANGE, granularity: 'day', audience: 'men' });
		const women = await buildAdAnalytics({ ...RANGE, granularity: 'day', audience: 'women' });
		// Meta's numeric campaign id carries no audience, so it lands in unknown.
		const unknown = await buildAdAnalytics({ ...RANGE, granularity: 'day', audience: 'unknown' });
		expect(men.health.counts.views).toBe(2);
		expect(women.health.counts.views).toBe(1);
		expect(unknown.health.counts.views).toBe(1);
	});

	it('composes the two filters', async () => {
		const d = await buildAdAnalytics({
			...RANGE,
			granularity: 'day',
			network: 'snap',
			audience: 'women'
		});
		expect(d.health.counts.views).toBe(1);
	});

	it('returns the unfiltered facets whatever the filter is, so the denominator survives', async () => {
		for (const network of ['all', 'snap', 'meta'] as const) {
			const d = await buildAdAnalytics({ ...RANGE, granularity: 'day', network });
			expect(d.facets.network.views, network).toEqual({ snap: 3, meta: 1 });
			expect(d.facets.audience.views, network).toEqual({ men: 2, women: 1, unknown: 1 });
		}
	});

	it('narrows the LEADERBOARD, not just the traffic columns', async () => {
		// The bug this pins: filtering only views and taps left every Snap ad set on
		// the table with its spend and impressions intact, so picking Meta read as
		// "Meta spent 187 rupees and got nothing".
		// Traffic cleared so this isolates the spend side.
		rows.marketing_page_views = [];
		rows.ad_spend_daily = [
			{
				network: 'snap',
				date: '2026-08-10',
				campaign_id: 'c1',
				campaign_name: 'MEN_25-40',
				ad_set_id: 'a1b2c3d4-1111-2222-3333-444455556666',
				ad_set_name: 'MEN_25-40',
				creative_id: '',
				spend: '126',
				currency: 'INR',
				impressions: 5482,
				clicks: 126,
				network_conversions: 0,
				fetched_at: '2026-08-10T01:00:00.000Z'
			},
			{
				network: 'meta',
				date: '2026-08-10',
				campaign_id: 'c2',
				campaign_name: '6978093820881',
				ad_set_id: '6978093820881',
				ad_set_name: 'META_SET',
				creative_id: '',
				spend: '61',
				currency: 'INR',
				impressions: 900,
				clicks: 20,
				network_conversions: 0,
				fetched_at: '2026-08-10T01:00:00.000Z'
			}
		];

		const meta = await buildAdAnalytics({ ...RANGE, granularity: 'day', network: 'meta' });
		expect(meta.leaderboard.map((r: any) => r.campaign)).toEqual(['META_SET']);
		// And the spend total follows the filter rather than staying whole.
		expect(meta.leaderboard[0].spend).toBe(61);
		expect(meta.health.counts.spendRows).toBe(1);

		const snap = await buildAdAnalytics({ ...RANGE, granularity: 'day', network: 'snap' });
		expect(snap.leaderboard.map((r: any) => r.campaign)).toEqual(['MEN_25-40']);

		const all = await buildAdAnalytics({ ...RANGE, granularity: 'day' });
		expect(all.leaderboard).toHaveLength(2);
	});

	it('narrows spend by targeted audience, read off the ad set name', async () => {
		rows.marketing_page_views = [];
		rows.ad_spend_daily = [
			{
				network: 'snap',
				date: '2026-08-10',
				campaign_id: 'c1',
				campaign_name: 'x',
				ad_set_id: 'aaaaaaaa-1111-2222-3333-444455556666',
				ad_set_name: 'MEN_25-40_CASUAL',
				creative_id: '',
				spend: '100',
				currency: 'INR',
				impressions: 10,
				clicks: 1,
				network_conversions: 0,
				fetched_at: '2026-08-10T01:00:00.000Z'
			},
			{
				network: 'snap',
				date: '2026-08-10',
				campaign_id: 'c2',
				campaign_name: 'y',
				ad_set_id: 'bbbbbbbb-1111-2222-3333-444455556666',
				ad_set_name: 'Female 18-22',
				creative_id: '',
				spend: '50',
				currency: 'INR',
				impressions: 10,
				clicks: 1,
				network_conversions: 0,
				fetched_at: '2026-08-10T01:00:00.000Z'
			}
		];

		const women = await buildAdAnalytics({ ...RANGE, granularity: 'day', audience: 'women' });
		expect(women.leaderboard.map((r: any) => r.campaign)).toEqual(['Female 18-22']);
		const men = await buildAdAnalytics({ ...RANGE, granularity: 'day', audience: 'men' });
		expect(men.leaderboard.map((r: any) => r.campaign)).toEqual(['MEN_25-40_CASUAL']);
	});

	it('drops unattributable signups from the trend once a filter is on', async () => {
		rows.verified_vibe_users = [
			{ id: '1', gender: 'man', created_at: '2026-08-10T07:00:00.000Z' },
			{ id: '2', gender: 'woman', created_at: '2026-08-10T07:00:00.000Z' }
		];

		const all = await buildAdAnalytics({ ...RANGE, granularity: 'day' });
		expect(all.trends.signups['2026-08-10']).toBe(2);
		expect(all.range.filtersActive).toBe(false);

		// user_acquisition is empty, so no signup can be tied to Meta. Showing 2
		// beside filtered views would draw conversions this slice did not produce.
		const meta = await buildAdAnalytics({ ...RANGE, granularity: 'day', network: 'meta' });
		expect(meta.trends.signups['2026-08-10']).toBe(0);
		expect(meta.range.filtersActive).toBe(true);
		// The whole-range gender total is unchanged and still says it cannot join.
		expect(meta.signupGender).toMatchObject({ man: 1, woman: 1, joinableToCampaign: false });
	});

	it('echoes the filter actually applied', async () => {
		const d = await buildAdAnalytics({ ...RANGE, granularity: 'day', network: 'meta', audience: 'men' });
		expect(d.range.network).toBe('meta');
		expect(d.range.audience).toBe('men');
	});

	it('reports signup gender unfiltered, and says it cannot be joined to a campaign', async () => {
		rows.verified_vibe_users = [
			{ id: '1', gender: 'man', created_at: '2026-08-10T07:00:00.000Z' },
			{ id: '2', gender: 'man', created_at: '2026-08-10T07:00:00.000Z' },
			{ id: '3', gender: 'woman', created_at: '2026-08-10T07:00:00.000Z' },
			{ id: '4', gender: null, created_at: '2026-08-10T07:00:00.000Z' }
		];
		const d = await buildAdAnalytics({ ...RANGE, granularity: 'day', network: 'meta' });
		// Not narrowed by the network filter — user_acquisition is empty, so no
		// signup can be attributed to a network at all.
		expect(d.signupGender).toEqual({ man: 2, woman: 1, unknown: 1, joinableToCampaign: false });
	});
});

describe('delivery state', () => {
	const SPEND = (over: Record<string, any>) => ({
		network: 'snap',
		date: '2026-08-10',
		campaign_id: 'c',
		campaign_name: 'n',
		ad_set_id: 'a1b2c3d4-1111-2222-3333-444455556666',
		ad_set_name: 'AD_SET_A',
		creative_id: '',
		spend: '0',
		currency: 'INR',
		impressions: 0,
		clicks: 0,
		network_conversions: 0,
		fetched_at: '2026-08-10T01:00:00.000Z',
		...over
	});
	const row = (d: any, name: string) => d.leaderboard.find((r: any) => r.campaign === name);

	it('counts impressions alone as delivering, even before anything is charged', async () => {
		rows.ad_spend_daily = [SPEND({ impressions: 55, clicks: 1, spend: '0' })];
		const d = await buildAdAnalytics({ ...RANGE, granularity: 'day' });
		expect(row(d, 'AD_SET_A').delivering).toBe(true);
	});

	it('counts traffic alone as delivering, because a silent spend feed is not a paused ad set', async () => {
		// Meta arrives with no spend rows at all — the credentials were never set.
		// Calling 13 landing page views "not delivering" would report a config gap
		// as an ad decision.
		rows.marketing_page_views = [
			{
				...V('2026-08-10T07:00:00.000Z', '6978093820881'),
				user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148',
				utm: { utm_source: 'ig', utm_campaign: '6978093820881' }
			}
		];
		const d = await buildAdAnalytics({ ...RANGE, granularity: 'day' });
		expect(row(d, '6978093820881').delivering).toBe(true);
	});

	it('is not delivering only when nothing happened on either side', async () => {
		rows.ad_spend_daily = [SPEND({ ad_set_name: 'IDLE_SET', impressions: 0, clicks: 0, spend: '0' })];
		const d = await buildAdAnalytics({ ...RANGE, granularity: 'day' });
		expect(row(d, 'IDLE_SET').delivering).toBe(false);
		expect(row(d, 'IDLE_SET').paidButNoTraffic).toBe(false);
	});

	it('flags clicks charged for with zero arrivals, and says so above the charts', async () => {
		rows.ad_spend_daily = [
			SPEND({ ad_set_name: 'BROKEN_DEST', impressions: 2292, clicks: 252, spend: '61' })
		];
		const d = await buildAdAnalytics({ ...RANGE, granularity: 'day' });

		const r = row(d, 'BROKEN_DEST');
		// Delivering — money is moving — but nothing is arriving. Both are true and
		// the second is the actionable one.
		expect(r.delivering).toBe(true);
		expect(r.paidButNoTraffic).toBe(true);
		expect(d.anomalies.join(' ')).toContain('BROKEN_DEST');
		expect(d.anomalies.join(' ')).toContain('252 clicks charged for');
	});

	it('does not cry broken on a handful of clicks that simply bounced', async () => {
		rows.ad_spend_daily = [SPEND({ ad_set_name: 'QUIET', impressions: 55, clicks: 1, spend: '1' })];
		const d = await buildAdAnalytics({ ...RANGE, granularity: 'day' });
		// The row still carries the flag, but it is below the threshold to shout.
		expect(row(d, 'QUIET').paidButNoTraffic).toBe(true);
		expect(d.anomalies.join(' ')).not.toContain('QUIET');
	});

	it('clears the flag as soon as one view arrives', async () => {
		rows.ad_spend_daily = [
			SPEND({ ad_set_name: 'AD_SET_A', impressions: 2292, clicks: 252, spend: '61' })
		];
		rows.marketing_page_views = [
			{
				...V('2026-08-10T07:00:00.000Z', 'AD_SET_A'),
				user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148',
				utm: {
					utm_source: 'snapchat',
					utm_campaign: 'AD_SET_A',
					utm_term: 'a1b2c3d4-1111-2222-3333-444455556666'
				}
			}
		];
		const d = await buildAdAnalytics({ ...RANGE, granularity: 'day' });
		expect(row(d, 'AD_SET_A').paidButNoTraffic).toBe(false);
		expect(d.anomalies.join(' ')).not.toContain('clicks charged for');
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

/**
 * The second bug these tests exist for.
 *
 * Snap's ad-review crawler fetches the landing page every time a creative is
 * edited. Measured on production 2026-08-10: 84 of 139 rows were crawler, from
 * desktop macOS, country US, on India-only campaigns. Counted as views it
 * inflates the denominator without inflating taps, so every rate deflates and
 * the campaigns flatten toward each other — worst on whichever one was most
 * recently edited, which is exactly the one being judged.
 */
const REAL_AD_SET = '0a534b93-dba8-4a44-8ec4-7afa0d2325a7';
const SNAP_UTM = { utm_source: 'snapchat', utm_campaign: 'men_lpv', utm_term: REAL_AD_SET };

const mobileView = (iso: string) => ({
	created_at: iso,
	page: 'get',
	campaign: 'men_lpv',
	country: 'IN',
	user_agent: 'Mozilla/5.0 (Linux; Android 15; CPH2825) AppleWebKit/537.36',
	utm: SNAP_UTM,
	visit_id: null
});
const crawlerView = (iso: string) => ({
	...mobileView(iso),
	country: 'US',
	user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15'
});

describe('crawler traffic is set aside, not counted', () => {
	it('keeps mobile Snap traffic and excludes desktop Snap traffic', async () => {
		rows.marketing_page_views = [
			mobileView('2026-08-10T07:00:00.000Z'),
			mobileView('2026-08-10T07:01:00.000Z'),
			crawlerView('2026-08-10T07:02:00.000Z'),
			crawlerView('2026-08-10T07:02:01.000Z'),
			crawlerView('2026-08-10T07:02:02.000Z')
		];

		const d = await buildAdAnalytics({ ...RANGE, granularity: 'day' });

		expect(d.traffic.viewsCounted).toBe(2);
		expect(d.traffic.viewsExcluded).toBe(3);
		expect(d.traffic.byReason.desktop_on_snap.count).toBe(3);
		// The trend must show the real number, not the inflated one.
		expect(d.trends.views).toEqual({ '2026-08-10': 2 });
	});

	it('joins spend to traffic on the ad set id', async () => {
		rows.marketing_page_views = [mobileView('2026-08-10T07:00:00.000Z')];
		rows.ad_spend_daily = [
			{
				network: 'snap',
				date: '2026-08-10',
				campaign_id: 'c',
				campaign_name: 'RA_TRAFFIC',
				ad_set_id: REAL_AD_SET,
				ad_set_name: 'MEN_25-40_CASUAL_STORY_IND-LPV',
				creative_id: '',
				spend: '100',
				currency: 'INR',
				impressions: 1000,
				clicks: 10,
				network_conversions: 0,
				account_timezone: 'Asia/Singapore',
				fetched_at: '2026-08-10T08:00:00.000Z'
			}
		];

		const d = await buildAdAnalytics({ ...RANGE, granularity: 'day' });

		// One row, not two — spend and its traffic must land together.
		const row = d.leaderboard.find((r: any) => r.adSetId === REAL_AD_SET);
		expect(row).toBeDefined();
		expect(row!.spend).toBe(100);
		expect(row!.views).toBe(1);
		expect(row!.costPerView).toBe(100);
		// 1 view against 10 network clicks — the billed-but-never-arrived leak.
		expect(row!.clickToViewRate).toBeCloseTo(0.1);
		expect(d.leaderboard.filter((r: any) => r.spend > 0)).toHaveLength(1);
	});

	it('never folds an unresolvable ad set into a real one', async () => {
		rows.marketing_page_views = [
			mobileView('2026-08-10T07:00:00.000Z'),
			// Macro never resolved — must not join to the real ad set above.
			{ ...mobileView('2026-08-10T07:05:00.000Z'), utm: { ...SNAP_UTM, utm_term: '{{adSet.id}}' } }
		];

		const d = await buildAdAnalytics({ ...RANGE, granularity: 'day' });

		expect(d.traffic.viewsWithoutAdSet).toBe(1);
		expect(d.leaderboard.find((r: any) => r.adSetId === REAL_AD_SET)!.views).toBe(1);
	});
});
