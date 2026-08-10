import { describe, it, expect } from 'vitest';
import { audienceOf, isAudience } from '../ad-audience';

/**
 * The substring overlap is the whole reason this file exists.
 *
 * "women" contains "men" and "female" contains "male", so a men-first regex
 * classifies women_18_30_blr_lifestyle_auto as men — which does not throw, does
 * not look wrong, and swaps the two biggest numbers on the page. Every real
 * campaign name in the account is pinned below.
 */

describe('audienceOf — the real campaign names in the account', () => {
	const cases: [string, string, 'men' | 'women' | 'unknown'][] = [
		['men_25_40_casual_story_ind_lpv', 'story_casual_men_7frame_v1', 'men'],
		['female_18_22_lpv', 'female_18_23', 'women'],
		['women_18_30_blr_lifestyle_auto', 'img_floodedwoman_nomoreclosingtab_v1', 'women'],
		// Meta passes a numeric campaign id, so nothing is derivable.
		['6978093820881', '6978093820681', 'unknown'],
		['get_lp', '', 'unknown'],
		['gate_check', '', 'unknown']
	];

	for (const [campaign, content, expected] of cases) {
		it(`${campaign} → ${expected}`, () => {
			expect(audienceOf({ campaign, utm: { utm_content: content } })).toBe(expected);
		});
	}
});

describe('the men/women substring trap', () => {
	it('never reads "women" as men', () => {
		for (const s of [
			'women_18_30',
			'women',
			'woman',
			'floodedwoman',
			'img_floodedwoman_v1',
			'all_women_blr'
		]) {
			expect(audienceOf({ campaign: s }), s).toBe('women');
		}
	});

	it('never reads "female" as male', () => {
		for (const s of ['female_18_22', 'females', 'female']) {
			expect(audienceOf({ campaign: s }), s).toBe('women');
		}
	});

	it('still recognises men where it genuinely says men', () => {
		for (const s of ['men_25_40', 'story_men_v1', 'male_audience', 'guys_18_24', 'men']) {
			expect(audienceOf({ campaign: s }), s).toBe('men');
		}
	});
});

describe('audienceOf — ambiguity and absence', () => {
	it('refuses to guess when a row names both', () => {
		expect(audienceOf({ campaign: 'men_and_women_broad' })).toBe('unknown');
		expect(audienceOf({ campaign: 'all', utm: { utm_content: 'men_v1', utm_term: 'women_v2' } })).toBe(
			'unknown'
		);
	});

	it('is unknown, not a guess, when there is nothing to read', () => {
		expect(audienceOf({})).toBe('unknown');
		expect(audienceOf({ campaign: null, utm: null })).toBe('unknown');
		expect(audienceOf({ campaign: '' })).toBe('unknown');
		expect(audienceOf({ campaign: '1234567890' })).toBe('unknown');
	});

	it('reads the campaign, the utm campaign, the content and the term', () => {
		expect(audienceOf({ utm: { utm_campaign: 'women_lp' } })).toBe('women');
		expect(audienceOf({ utm: { utm_content: 'creative_men_7frame' } })).toBe('men');
		expect(audienceOf({ utm: { utm_term: 'men_25_40' } })).toBe('men');
	});

	it('does not match a bare "m" or stray letters inside unrelated words', () => {
		// 'management', 'moment', 'women' handled above — these must not classify.
		for (const s of ['management_test', 'moment_v1', 'lpv', 'summer_promo']) {
			expect(audienceOf({ campaign: s }), s).toBe('unknown');
		}
	});
});

describe('isAudience', () => {
	it('accepts only the three buckets', () => {
		expect(isAudience('men')).toBe(true);
		expect(isAudience('women')).toBe(true);
		expect(isAudience('unknown')).toBe(true);
		expect(isAudience('all')).toBe(false);
		expect(isAudience('')).toBe(false);
		expect(isAudience(null)).toBe(false);
	});
});
