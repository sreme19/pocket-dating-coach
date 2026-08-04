import { describe, it, expect } from 'vitest';
import {
	computeGapBar, HANDOFF_THRESHOLD, STAGE_WEIGHTS, type GapBarInput
} from '../gap-bar';
import type { Vec } from '../vector-scoring';

// A woman whose top provable values are lifestyle and presentation, plus financial
// (which must never become a target).
const her: Vec = {
	financial: 0.24, lifestyle: 0.20, presentation: 0.16, ambition: 0.12,
	social_legitimacy: 0.11, warmth: 0.08, humor: 0.05, intellect: 0.02, family: 0.01, looks: 0.01,
};
// He claims a lot and has proven nothing.
const claimsNothingProven: Vec = {
	financial: 70, lifestyle: 65, presentation: 60, ambition: 55, social_legitimacy: 50,
	warmth: 55, humor: 55, intellect: 55, family: 50, looks: 55,
};
const unproven: Vec = {
	financial: 0.3, lifestyle: 0.3, presentation: 0.3, ambition: 0.3, social_legitimacy: 0.3,
	warmth: 0.3, humor: 0.3, intellect: 0.3, family: 0.3, looks: 0.3,
};
const base: GapBarInput = {
	herWeights: her, hisAttrs: claimsNothingProven, hisConf: unproven,
	verifiedCategories: [], refusedCategories: [], fitPass: true,
};

describe('computeGapBar', () => {
	it('sums to 100 when everything is proven', () => {
		const allProven: Vec = Object.fromEntries(Object.keys(unproven).map((k) => [k, 1]));
		const bar = computeGapBar({ ...base, hisConf: allProven });
		expect(bar.percent).toBe(100);
		expect(bar.handoffReady).toBe(true);
		expect(bar.stages.every((s) => s.complete)).toBe(true);
	});

	it('gives an unproven man his fit points and little else', () => {
		const bar = computeGapBar(base);
		expect(bar.stages.find((s) => s.id === 'fit')!.earned).toBe(STAGE_WEIGHTS.fit);
		expect(bar.percent).toBeLessThan(30);
		expect(bar.handoffReady).toBe(false);
	});

	it('opens at a real number for a well-verified man, before he says a word', () => {
		// The ledger carries PROOFS across matches, so a man who has verified things
		// elsewhere should not start from zero in a new thread.
		const someProven: Vec = { ...unproven, lifestyle: 1, presentation: 1 };
		const bar = computeGapBar({ ...base, hisConf: someProven });
		expect(bar.percent).toBeGreaterThan(35);
	});

	// ── The rule the whole design rests on ────────────────────────────────────
	it('is ABSOLUTE — no rival input exists in the signature at all', () => {
		// Guards against the "top 3 of her suitors" model creeping back in. If a rival
		// array ever appears here, 11 of 14 men get a path that cannot be walked.
		const keys = Object.keys(base);
		expect(keys.some((k) => /rival|rank|percentile|standing|competitor/i.test(k))).toBe(false);
	});

	it('never falls below the previous value on its own', () => {
		// Her weights changed on a re-vet, moving stage 3's targets. He did nothing.
		const shifted: Vec = { ...her, lifestyle: 0.01, ambition: 0.30, social_legitimacy: 0.28 };
		const bar = computeGapBar({ ...base, herWeights: shifted, previousPercent: 64 });
		expect(bar.percent).toBeGreaterThanOrEqual(64);
	});

	it('may fall ONLY when he retracted a claim or a proof failed', () => {
		const bar = computeGapBar({ ...base, previousPercent: 64, allowDecrease: true });
		expect(bar.percent).toBeLessThan(64);
	});

	it('a refusal stalls the bar rather than subtracting from it', () => {
		const before = computeGapBar(base).percent;
		const after = computeGapBar({ ...base, refusedCategories: ['travel', 'lifestyle'] }).percent;
		expect(after).toBe(before);
	});

	// ── Money ─────────────────────────────────────────────────────────────────
	it('never offers a money proof as the next action, even as her top weight', () => {
		// financial is her single highest weight (0.24) and he is loudly claiming it (70).
		const bar = computeGapBar(base);
		const all = [bar.nextAction, ...bar.alternatives].filter(Boolean);
		expect(all.every((a) => a!.dim !== 'financial')).toBe(true);
		expect(all.every((a) => !['wealth', 'assets', 'spending'].includes(a!.category))).toBe(true);
	});

	it('does not make money a standout target', () => {
		const standout = computeGapBar(base).stages.find((s) => s.id === 'standout')!;
		// 3 targets from lifestyle/presentation/ambition/social_legitimacy — never financial.
		expect(standout.detail).toMatch(/0 of 3/);
	});

	// ── The cap, which is what keeps 90 reachable ─────────────────────────────
	it('no single stage lets one item dominate it', () => {
		// One lone claim would otherwise be worth the entire 30-point stage, which is
		// what would let a single refusal put 90 out of reach.
		const oneClaim: Vec = { ...claimsNothingProven, lifestyle: 10, presentation: 10, ambition: 10, social_legitimacy: 10 };
		const bar = computeGapBar({ ...base, hisAttrs: { ...oneClaim, financial: 70 } });
		for (const s of bar.stages) expect(s.earned).toBeLessThanOrEqual(s.weight);
		const corr = bar.stages.find((s) => s.id === 'corroboration')!;
		expect(corr.earned).toBeLessThanOrEqual(STAGE_WEIGHTS.corroboration);
	});

	it('REACHABILITY — refusing any one category leaves 90 attainable', () => {
		// This is the guarantee the per-stage floor exists to protect, asserted directly
		// rather than approximated by a display cap. For each category he might decline,
		// proving everything else must still clear the threshold. Without it, half of all
		// asks being refused in production would wall men out permanently.
		const everyCategory = ['travel', 'lifestyle', 'discipline', 'linkedin', 'social_proof'];
		for (const refusedOne of everyCategory) {
			const allElseProven: Vec = Object.fromEntries(Object.keys(unproven).map((k) => [k, 1]));
			const bar = computeGapBar({
				...base, hisConf: allElseProven, refusedCategories: [refusedOne],
			});
			expect(bar.percent, `refusing ${refusedOne} must not block 90`).toBeGreaterThanOrEqual(HANDOFF_THRESHOLD);
		}
	});

	it('keeps at least two live routes open for a man with everything to prove', () => {
		const bar = computeGapBar(base);
		expect([bar.nextAction, ...bar.alternatives].filter(Boolean).length).toBeGreaterThanOrEqual(2);
	});

	it('never offers an upload that would earn nothing', () => {
		const allProven: Vec = Object.fromEntries(Object.keys(unproven).map((k) => [k, 1]));
		const bar = computeGapBar({ ...base, hisConf: allProven });
		expect(bar.nextAction).toBeNull();
		expect(bar.alternatives).toEqual([]);
	});

	it('the quoted worth is what he actually gets', () => {
		// Computed by re-running the real calculation, so it cannot drift from reality —
		// this number goes in front of him.
		const bar = computeGapBar(base);
		const a = bar.nextAction!;
		const after = computeGapBar({ ...base, hisConf: { ...unproven, [a.dim]: 1 } });
		expect(after.percent - bar.percent).toBeCloseTo(a.worth, 1);
	});

	// ── Held, and fit ─────────────────────────────────────────────────────────
	// Every picture route there is. Five used to be enough to exhaust him, which was
	// the bug: `hosting`, `intro`, `instagram`, `habit_tracker` and `twitter` all exist
	// and carry real dimension confidence, and nothing ever offered them.
	const EVERY_PICTURE_ROUTE = [
		'travel', 'lifestyle', 'discipline', 'linkedin', 'social_proof',
		'hosting', 'intro', 'instagram', 'habit_tracker', 'twitter',
	];

	it('reports held with a named reason when every route was refused', () => {
		const bar = computeGapBar({ ...base, refusedCategories: EVERY_PICTURE_ROUTE });
		expect(bar.held).toBe(true);
		expect(bar.heldPhrase).toBeTruthy();
		expect(bar.nextAction).toBeNull();
	});

	it('one refusal does not kill a dimension that has other routes', () => {
		// `linkedin` sits in BOTH social_legitimacy and ambition, and the old rule took
		// out any dimension containing a refused category — so declining it killed two
		// of four dimensions at once and left a third of real matches with no
		// alternative route at all. social_legitimacy still has social_proof, instagram
		// and twitter, so it must survive.
		const bar = computeGapBar({ ...base, refusedCategories: ['linkedin'] });
		const offered = [bar.nextAction, ...bar.alternatives].filter(Boolean);
		expect(offered.some((a) => a!.dim === 'social_legitimacy')).toBe(true);
		expect(offered.every((a) => a!.category !== 'linkedin')).toBe(true);
	});

	it('offers more than the four things it used to', () => {
		// The suggestion was named after the DIMENSION, so there were exactly four
		// possible asks product-wide and a man in six conversations heard the same one
		// six times. Naming the CATEGORY gives him the real taxonomy.
		const seen = new Set<string>();
		for (const refused of [[], ['travel'], ['travel', 'lifestyle'], ['travel', 'lifestyle', 'discipline'], ['travel', 'lifestyle', 'discipline', 'linkedin']]) {
			const bar = computeGapBar({ ...base, refusedCategories: refused });
			for (const a of [bar.nextAction, ...bar.alternatives].filter(Boolean)) seen.add(a!.phrase);
		}
		expect(seen.size).toBeGreaterThan(4);
	});

	it('never offers a document proof in chat, however many routes open up', () => {
		// Broadening the taxonomy must not have opened a door to the money categories.
		for (const refused of [[], ['travel'], ['linkedin'], ['travel', 'lifestyle', 'discipline']]) {
			const bar = computeGapBar({ ...base, refusedCategories: refused });
			for (const a of [bar.nextAction, ...bar.alternatives].filter(Boolean)) {
				expect(['wealth', 'assets', 'spending']).not.toContain(a!.category);
			}
		}
	});

	it('is not held once he is past the threshold', () => {
		const allProven: Vec = Object.fromEntries(Object.keys(unproven).map((k) => [k, 1]));
		expect(computeGapBar({ ...base, hisConf: allProven }).held).toBe(false);
	});

	it('flags a fit failure instead of silently capping him', () => {
		const bar = computeGapBar({ ...base, fitPass: false });
		expect(bar.fitFailed).toBe(true);
		expect(bar.stages.find((s) => s.id === 'fit')!.earned).toBe(0);
	});

	it('degrades to an honest zero with no vectors, rather than inventing a number', () => {
		const bar = computeGapBar({ ...base, hisAttrs: null, hisConf: null });
		expect(bar.percent).toBe(0);
		expect(bar.stages).toEqual([]);
	});

	it('judges standout on his own profile when she has no weights yet', () => {
		const bar = computeGapBar({ ...base, herWeights: null });
		const standout = bar.stages.find((s) => s.id === 'standout')!;
		expect(standout.detail).toMatch(/until she has told us more/);
		expect(bar.percent).toBeGreaterThan(0);
	});

	it('does not punish a man who claims nothing', () => {
		const modest: Vec = Object.fromEntries(Object.keys(claimsNothingProven).map((k) => [k, 20]));
		const bar = computeGapBar({ ...base, hisAttrs: modest });
		expect(bar.stages.find((s) => s.id === 'corroboration')!.complete).toBe(true);
	});

	it('terminates — the worth calculation does not recurse forever', () => {
		expect(() => computeGapBar(base)).not.toThrow();
		expect(computeGapBar(base).percent).toBeGreaterThan(0);
	});

	it('threshold is the documented 90', () => {
		expect(HANDOFF_THRESHOLD).toBe(90);
	});
});
