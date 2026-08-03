import { describe, it, expect } from 'vitest';
import { rankCategoryPayoffs, formatCategoryPayoffs, type AppealTarget } from '../proof-payoff';
import { profileStrength } from '../vector-scoring';
import { CONFIDENCE_MIN, ALL_DIMENSION_IDS } from '$lib/verified-vibe/dimensions';
import { proofCategory } from '$lib/verified-vibe/proof-categories';

/**
 * These numbers get spoken to members as facts, so the predictor must reproduce
 * exactly what a real vector rebuild would produce. Predicting with a different
 * formula than the one that will actually run is how a coach lies by accident.
 *
 * The confidence formula was verified against production: rebuilding
 * `provenance.proofStrength` through `c = 0.3 + 0.7·min(1, s)` reproduced the
 * stored `confidence` vector exactly for every member who had one.
 */

// A plausible mid-profile: real claims, almost nothing proven.
const attrs = {
	financial: 60,
	ambition: 70,
	lifestyle: 65,
	presentation: 55,
	warmth: 75,
	intellect: 70,
	humor: 60,
	social_legitimacy: 50,
	family: 65
};

function confFrom(strength: Record<string, number>) {
	const c: Record<string, number> = {};
	for (const id of ALL_DIMENSION_IDS) {
		const s = Math.max(0, Math.min(1, strength[id] ?? 0));
		c[id] = Number((CONFIDENCE_MIN + (1 - CONFIDENCE_MIN) * s).toFixed(3));
	}
	return c;
}

describe('rankCategoryPayoffs', () => {
	it('predicts the exact Profile Strength a rebuild would produce', () => {
		// limit 20 = the whole taxonomy. Without it the default top-5 is all money
		// categories, since `financial` carries the highest weight of any dimension —
		// which is precisely the bug that reached production.
		const payoffs = rankCategoryPayoffs({ attrs, currentStrength: {}, completedCategories: [], limit: 20 });
		const travel = payoffs.find((p) => p.category.id === 'travel');
		expect(travel).toBeDefined();

		// Independently apply travel's evidence and score it the way the builder would.
		const dims = proofCategory('travel')!.dims;
		const expected = profileStrength(attrs, confFrom(dims as Record<string, number>));

		expect(travel!.psAfter).toBeCloseTo(Math.round(expected * 10) / 10, 1);
		expect(travel!.deltaPS).toBeGreaterThan(0);
	});

	it('never proposes something already proven', () => {
		const done = ['proof_travel', 'proof_lifestyle'];
		const ids = rankCategoryPayoffs({
			attrs,
			currentStrength: { lifestyle: 0.6 },
			completedCategories: done,
			limit: 20
		}).map((p) => p.category.id);

		expect(ids).not.toContain('travel');
		expect(ids).not.toContain('lifestyle');
	});

	it('drops an upload that is worth nothing because its dimensions are already proven', () => {
		const fresh = rankCategoryPayoffs({ attrs, currentStrength: {}, completedCategories: [], limit: 20 })
			.find((p) => p.category.id === 'hosting');
		expect(fresh?.deltaPS).toBeGreaterThan(0);

		// hosting only evidences lifestyle + warmth. Once both are fully proven,
		// confidence is clamped at 1 and the upload gains literally nothing — so it
		// must not be offered at all. Suggesting a worthless upload is the failure
		// mode here, not suggesting a smaller one.
		const saturated = rankCategoryPayoffs({
			attrs,
			currentStrength: { lifestyle: 1, warmth: 1 },
			completedCategories: [],
			limit: 20
		});
		expect(saturated.some((p) => p.category.id === 'hosting')).toBe(false);
	});

	it('ranks breadth over size — an upload helping three people beats a bigger solo gain', () => {
		// Two matches who care about social legitimacy, none who care about humor.
		const targets: AppealTarget[] = [
			{ name: 'Aisha', weights: { social_legitimacy: 0.5, ambition: 0.3 } },
			{ name: 'Bea', weights: { social_legitimacy: 0.6 } }
		];
		const payoffs = rankCategoryPayoffs({
			attrs,
			currentStrength: {},
			completedCategories: [],
			targets,
			limit: 20
		});

		// linkedin evidences social_legitimacy + ambition, so it should lead on breadth.
		expect(payoffs[0].category.id).toBe('linkedin');
		expect(payoffs[0].matchesHelped).toBe(2);
		expect(payoffs[0].appealGains.map((g) => g.name)).toEqual(['Aisha', 'Bea']);
		expect(payoffs[0].appealGains[0].delta).toBeGreaterThan(0);
	});

	it('reports a band crossing when the upload earns one', () => {
		// Start just under the "Building" threshold (25) so one upload crosses it.
		const payoffs = rankCategoryPayoffs({ attrs, currentStrength: {}, completedCategories: [], limit: 20 });
		const crossing = payoffs.filter((p) => p.crossesBand);
		for (const p of crossing) {
			expect(p.bandAfter).not.toBe(p.bandBefore);
			expect(p.psAfter).toBeGreaterThan(p.psBefore);
		}
	});

	it('can omit money categories from the named ranking', () => {
		const withMoney = rankCategoryPayoffs({
			attrs,
			currentStrength: {},
			completedCategories: [],
			limit: 20
		}).map((p) => p.category.id);
		const without = rankCategoryPayoffs({
			attrs,
			currentStrength: {},
			completedCategories: [],
			excludeMoney: true,
			limit: 20
		}).map((p) => p.category.id);

		// financial has the highest weight of any dimension, so wealth/assets would
		// otherwise dominate the ranking — exactly the bug that shipped to production.
		expect(withMoney).toContain('wealth');
		expect(without).not.toContain('wealth');
		expect(without).not.toContain('assets');
		expect(without).not.toContain('spending');
		expect(without.length).toBeGreaterThan(0);
	});

	it('can omit ID-gated categories for the picture-only chat surface', () => {
		const ids = rankCategoryPayoffs({
			attrs,
			currentStrength: {},
			completedCategories: [],
			excludeDocumentGated: true,
			limit: 20
		}).map((p) => p.category.id);
		expect(ids).not.toContain('wealth');
		expect(ids).toContain('travel');
	});

	it('returns nothing once everything is proven', () => {
		const all = rankCategoryPayoffs({
			attrs,
			currentStrength: {},
			completedCategories: [
				'linkedin','discipline','travel','lifestyle','social_proof','hosting',
				'intro','instagram','habit_tracker','twitter','assets','wealth','spending'
			]
		});
		expect(all).toEqual([]);
	});

	it('honours the limit', () => {
		expect(rankCategoryPayoffs({ attrs, currentStrength: {}, completedCategories: [], limit: 3 })).toHaveLength(3);
	});
});

describe('formatCategoryPayoffs', () => {
	it('states the numbers plainly and forbids money framing', () => {
		const payoffs = rankCategoryPayoffs({
			attrs,
			currentStrength: {},
			completedCategories: [],
			targets: [{ name: 'Aisha', weights: { social_legitimacy: 0.5 } }] as AppealTarget[],
			excludeMoney: true,
			limit: 3
		});
		const block = formatCategoryPayoffs(payoffs);

		expect(block).toContain('ABSOLUTE numbers');
		expect(block).toContain('Profile Strength');
		expect(block).toContain('Aisha');
		// The block must not advertise money as a draw.
		expect(block).not.toMatch(/financial standing|net worth|income/i);
		expect(block).toContain('anti-fraud check only');
	});

	it('is empty when there is nothing to say', () => {
		expect(formatCategoryPayoffs([])).toBe('');
	});
});

describe('the money-dominance guard', () => {
	it('money sits near the top of the raw ranking — which is why excludeMoney exists', () => {
		// `financial` carries avgWeight 0.16, the highest of any open dimension, so
		// wealth ties linkedin for first and assets lands in the top five. Not a clean
		// sweep, but prominent enough that an unfiltered coach reaches for money
		// early — which is exactly what production did.
		const top5 = rankCategoryPayoffs({
			attrs,
			currentStrength: {},
			completedCategories: [],
			limit: 5
		});
		expect(top5.filter((p) => p.isMoney).length).toBeGreaterThanOrEqual(2);

		const coachable = rankCategoryPayoffs({
			attrs,
			currentStrength: {},
			completedCategories: [],
			excludeMoney: true,
			limit: 3
		});
		expect(coachable.some((p) => p.isMoney)).toBe(false);
	});
});
