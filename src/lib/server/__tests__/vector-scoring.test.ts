import { describe, it, expect } from 'vitest';
import {
	appeal,
	mutualValue,
	isLopsided,
	profileStrength,
	profileStrengthBand,
	standingRank,
	upsidePreview,
	upsideByDimension,
	pathGaps,
	portfolioActions,
	type Vec,
} from '../vector-scoring';
import {
	ALL_DIMENSION_IDS,
	OPEN_DIMENSION_IDS,
	SENSITIVE_DIMENSION_IDS,
	POPULATION_AVG_WEIGHTS,
} from '$lib/verified-vibe/dimensions';

/**
 * Unit tests for the pure vector scoring engine (Design Appendix A). These prove
 * the math independent of DB/LLM, including the two worked examples from the doc.
 */

// Helpers to build full vectors quickly.
const fill = (val: number): Vec => Object.fromEntries(ALL_DIMENSION_IDS.map((d) => [d, val]));
const weightsOn = (dims: string[]): Vec => {
	const w: Vec = Object.fromEntries(ALL_DIMENSION_IDS.map((d) => [d, 0]));
	for (const d of dims) w[d] = 1 / dims.length;
	return w;
};

describe('appeal A(subject→evaluator) = Σ w·v·c', () => {
	it('is bounded 0–100; max when all v=100,c=1 and weights sum to 1', () => {
		const w = Object.fromEntries(ALL_DIMENSION_IDS.map((d) => [d, 1 / ALL_DIMENSION_IDS.length]));
		expect(appeal(w, fill(100), fill(1))).toBe(100);
		expect(appeal(w, fill(0), fill(1))).toBe(0);
	});

	it('only rewards dimensions the evaluator weights', () => {
		const wWealth = weightsOn(['financial']); // she only cares about financial
		const richAttrs: Vec = { ...fill(0), financial: 80 };
		const buffAttrs: Vec = { ...fill(0), presentation: 80 };
		expect(appeal(wWealth, richAttrs, fill(1))).toBe(80); // 1·80·1
		expect(appeal(wWealth, buffAttrs, fill(1))).toBe(0);  // strength she doesn't weight = nothing
	});

	it('discounts unproven claims via the confidence multiplier', () => {
		const w = weightsOn(['financial']);
		const claim: Vec = { ...fill(0), financial: 100 };
		const proven: Vec = { ...fill(0.3), financial: 1.0 };
		const unproven: Vec = { ...fill(0.3), financial: 0.3 }; // c_min floor
		expect(appeal(w, claim, proven)).toBe(100);
		expect(appeal(w, claim, unproven)).toBe(30); // same claim, low confidence → caps contribution
	});
});

describe('mutualValue — geometric mean penalises lopsidedness (§9d)', () => {
	it('a balanced 50/50 pair beats a one-sided 90/10 pair', () => {
		expect(mutualValue(50, 50)).toBe(50);
		expect(mutualValue(90, 10)).toBe(30); // √900 = 30 < 50, the hollow match
	});
	it('min() is the conservative alternative', () => {
		expect(mutualValue(90, 10, 'min')).toBe(10);
		expect(mutualValue(50, 50, 'min')).toBe(50);
	});
	it('flags lopsided pairs as fragile', () => {
		expect(isLopsided(90, 10)).toBe(true);
		expect(isLopsided(55, 50)).toBe(false);
	});
});

describe('appeal aggregation is compensatory (§7a worked example)', () => {
	// Woman weighting wealth 0.5 and warmth 0.5.
	const w: Vec = { ...fill(0), financial: 0.5, warmth: 0.5 };
	it('spiky 100/0 and balanced 50/50 both score 50 under the linear sum', () => {
		const spiky: Vec = { ...fill(0), financial: 100, warmth: 0 };   // Man A
		const balanced: Vec = { ...fill(0), financial: 50, warmth: 50 }; // Man B
		expect(appeal(w, spiky, fill(1))).toBe(50);
		expect(appeal(w, balanced, fill(1))).toBe(50);
	});
});

describe('profileStrength — open dims only, sensitive excluded (§8)', () => {
	it('sums to ~100 when all open attrs=100,c=1 (open w̄ sum to 1)', () => {
		expect(profileStrength(fill(100), fill(1))).toBe(100);
	});

	it('ignores sensitive dimensions entirely', () => {
		// Max out ONLY sensitive dims — PS must stay 0.
		const attrs: Vec = { ...fill(0) };
		const conf: Vec = { ...fill(0) };
		for (const d of SENSITIVE_DIMENSION_IDS) { attrs[d] = 100; conf[d] = 1; }
		expect(profileStrength(attrs, conf)).toBe(0);
	});

	it('open-dimension population weights sum to 1', () => {
		const total = OPEN_DIMENSION_IDS.reduce((s, d) => s + POPULATION_AVG_WEIGHTS[d], 0);
		expect(total).toBeCloseTo(1, 6);
	});

	it('raising confidence (verifying) raises PS — the coachable lever', () => {
		const attrs = fill(60);
		const low = profileStrength(attrs, fill(0.3));
		const high = profileStrength(attrs, fill(1));
		expect(high).toBeGreaterThan(low);
	});

	it('bands map sensibly', () => {
		expect(profileStrengthBand(80)).toBe('Top tier');
		expect(profileStrengthBand(10)).toBe('Getting started');
	});
});

describe('standingRank within a stack', () => {
	it('counts only strictly-higher rivals', () => {
		expect(standingRank(70, [90, 80, 60, 50])).toEqual({ rank: 3, pool: 5 });
		expect(standingRank(95, [90, 80])).toEqual({ rank: 1, pool: 3 });
		expect(standingRank(50, [])).toEqual({ rank: 1, pool: 1 });
	});
});

describe('verification upside (§3a locked standing)', () => {
	it('previews PS if all current claims were verified', () => {
		const attrs = fill(70);
		const conf = fill(0.3); // everything claimed, nothing proven
		const { psNow, psVerified, deltaPS } = upsidePreview(attrs, conf);
		expect(psVerified).toBeGreaterThan(psNow);
		expect(deltaPS).toBeGreaterThan(0);
	});

	it('ranks which single verification raises PS most', () => {
		const attrs: Vec = { ...fill(40), financial: 95 }; // big claim on financial
		const conf: Vec = { ...fill(1), financial: 0.3 };   // ...but unproven
		const ranked = upsideByDimension(attrs, conf);
		expect(ranked[0].dim).toBe('financial'); // verifying financial is the top lever
		expect(ranked[0].deltaPS).toBeGreaterThan(0);
	});
});

describe('pathGaps — per-match coaching levers (§11c)', () => {
	it('surfaces the dimension she weights where his effective value has most room', () => {
		// She cares about warmth (0.6) and financial (0.4). He: warmth claimed but
		// unproven (v70,c0.3), financial proven (v80,c1).
		const herWeights: Vec = { ...fill(0), warmth: 0.6, financial: 0.4 };
		const hisAttrs: Vec = { ...fill(0), warmth: 70, financial: 80 };
		const hisConf: Vec = { ...fill(0.3), warmth: 0.3, financial: 1 };
		const gaps = pathGaps(herWeights, hisAttrs, hisConf);
		expect(gaps[0].dim).toBe('warmth');     // highest weight × most room
		expect(gaps[0].lever).toBe('verify');    // decent claim, low confidence → verify
	});

	it('flags a genuinely-thin dimension as strengthen, not verify', () => {
		const herWeights: Vec = { ...fill(0), ambition: 1 };
		const hisAttrs: Vec = { ...fill(0), ambition: 20 }; // low claim
		const hisConf: Vec = { ...fill(1), ambition: 1 };
		const gaps = pathGaps(herWeights, hisAttrs, hisConf);
		expect(gaps[0].dim).toBe('ambition');
		expect(gaps[0].lever).toBe('strengthen');
	});

	it('never coaches toward sensitive dimensions (open dims only)', () => {
		const herWeights: Vec = { ...fill(0), looks: 1, faith: 1 }; // sensitive only
		const gaps = pathGaps(herWeights, fill(30), fill(0.3));
		expect(gaps.length).toBe(0); // nothing coachable
	});
});

describe('portfolioActions — cross-match breadth (§10/§11a)', () => {
	// Man: strong-but-UNPROVEN financial claim; ambition already proven; rest neutral.
	const attrs: Vec = { ...fill(50), financial: 80, ambition: 70 };
	const conf: Vec = { ...fill(0.3), ambition: 1 };

	it('ranks a verify-action by how many matches it helps, names them, skips proven dims', () => {
		const stacks = [
			{ name: 'Alice', weights: weightsOn(['financial']) },
			{ name: 'Bella', weights: weightsOn(['financial']) },
			{ name: 'Cara',  weights: weightsOn(['humor']) },
		];
		const actions = portfolioActions(attrs, conf, stacks, { max: 5 });

		const financial = actions.find((a) => a.dim === 'financial');
		const humor = actions.find((a) => a.dim === 'humor');

		// Verifying financial helps the two financial-weighting women; humor helps one.
		expect(financial?.stacksHelped).toBe(2);
		expect(financial?.helpedNames.sort()).toEqual(['Alice', 'Bella']);
		expect(humor?.stacksHelped).toBe(1);
		expect(humor?.helpedNames).toEqual(['Cara']);

		// Breadth wins: the 2-stack move outranks the 1-stack move.
		expect(actions[0].dim).toBe('financial');

		// Already-proven dims are never a verify-action.
		expect(actions.some((a) => a.dim === 'ambition')).toBe(false);
	});

	it('degrades to global-PS upside when there are no stacks (stacksHelped=0)', () => {
		const actions = portfolioActions(attrs, conf, []);
		expect(actions.length).toBeGreaterThan(0);         // still surfaces global upside
		expect(actions.every((a) => a.stacksHelped === 0)).toBe(true);
		expect(actions.every((a) => a.helpedNames.length === 0)).toBe(true);
		expect(actions.every((a) => a.deltaPS > 0)).toBe(true);
	});
});
