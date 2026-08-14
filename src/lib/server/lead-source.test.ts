import { describe, it, expect } from 'vitest';
import { buildLeadSources, leadSourceOf, type LeadSourceInputs } from './lead-source';

const EMPTY: LeadSourceInputs = {
	acquisition: [],
	landingSessions: [],
	referralInvites: [],
	referralRewards: [],
	emailById: new Map<string, string>(),
	nameById: new Map<string, string | null>()
};

const sourceFor = (input: Partial<LeadSourceInputs>, userId: string) =>
	leadSourceOf(buildLeadSources({ ...EMPTY, ...input }), userId);

describe('lead source', () => {
	it('is unknown when nothing recorded the arrival', () => {
		expect(sourceFor({}, 'u1').source).toBe('unknown');
	});

	it('reads snap and meta off the install referrer', () => {
		expect(
			sourceFor({ acquisition: [{ user_id: 'u1', network: 'snapchat', utm: { utm_source: 'snapchat' } }] }, 'u1')
				.source
		).toBe('snap');
		// utm_source carries the PLACEMENT on Meta — `fb`/`ig`, never `meta`.
		expect(
			sourceFor({ acquisition: [{ user_id: 'u1', network: 'ig', utm: { utm_source: 'ig' } }] }, 'u1').source
		).toBe('meta');
	});

	it('calls a store install with no campaign organic, not unknown', () => {
		const v = sourceFor(
			{ acquisition: [{ user_id: 'u1', network: 'google-play', utm: { utm_source: 'google-play' } }] },
			'u1'
		);
		expect(v.source).toBe('organic');
		expect(v.evidence).toBe('install_referrer');
	});

	it('attributes a landing-page visitor by the provisional user the visit created', () => {
		const v = sourceFor(
			{ landingSessions: [{ user_id: 'u1', utm: { utm_source: 'fb', utm_campaign: '6978749199681' } }] },
			'u1'
		);
		expect(v.source).toBe('meta');
		expect(v.detail).toBe('6978749199681');
	});

	it('attributes a claimed landing session to the real account it became', () => {
		expect(
			sourceFor(
				{ landingSessions: [{ user_id: null, claimed_by_user_id: 'u2', utm: { utm_source: 'snapchat' } }] },
				'u2'
			).source
		).toBe('snap');
	});

	it('ignores a landing session carrying no paid utm', () => {
		expect(sourceFor({ landingSessions: [{ user_id: 'u1', utm: null }] }, 'u1').source).toBe('unknown');
	});

	it('matches a referral invite by email when the invite was never matched', () => {
		const v = sourceFor(
			{
				referralInvites: [{ email: 'Her@Example.com ', referrer_id: 'r1', matched_user_id: null }],
				emailById: new Map([['u1', 'her@example.com']]),
				nameById: new Map([['r1', 'Linda']])
			},
			'u1'
		);
		expect(v.source).toBe('referral');
		expect(v.detail).toBe('referred by Linda');
	});

	it('cites the paid reward over the bare invite for the same member', () => {
		const v = sourceFor(
			{
				referralInvites: [{ email: 'him@example.com', referrer_id: 'r1', matched_user_id: 'u1' }],
				referralRewards: [{ referred_user_id: 'u1', referrer_id: 'r1' }],
				nameById: new Map([['r1', 'Linda']])
			},
			'u1'
		);
		expect(v.source).toBe('referral');
		expect(v.evidence).toBe('referral_reward');
	});

	/**
	 * The precedence that keeps a channel from being swallowed. A referred member
	 * who installs from a plain Play button carries the store's own organic
	 * referrer; if that won, every referral would report as organic.
	 */
	it('keeps referral ahead of an organic install referrer', () => {
		const v = sourceFor(
			{
				acquisition: [{ user_id: 'u1', network: 'google-play', utm: { utm_source: 'google-play' } }],
				referralRewards: [{ referred_user_id: 'u1', referrer_id: 'r1' }],
				nameById: new Map([['r1', 'Linda']])
			},
			'u1'
		);
		expect(v.source).toBe('referral');
	});

	it('lets a paid install referrer outrank both referral and a landing visit', () => {
		const v = sourceFor(
			{
				acquisition: [{ user_id: 'u1', network: 'snapchat', campaign: 'men_25_40', utm: { utm_source: 'snapchat' } }],
				landingSessions: [{ user_id: 'u1', utm: { utm_source: 'fb' } }],
				referralRewards: [{ referred_user_id: 'u1', referrer_id: 'r1' }]
			},
			'u1'
		);
		expect(v.source).toBe('snap');
		expect(v.detail).toBe('men_25_40');
	});
});
