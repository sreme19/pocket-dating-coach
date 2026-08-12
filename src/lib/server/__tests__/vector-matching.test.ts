import { describe, it, expect } from 'vitest';
import { solveMatching, type MatchCandidate, type MatchCaps } from '../vector-matching';

const caps = (manFloor: number, manCap: number, womanCap: number): MatchCaps => ({ manFloor, manCap, womanCap });
const cand = (manId: string, womanId: string, value: number, psGap = 0): MatchCandidate => ({ manId, womanId, value, psGap });
const key = (a: { manId: string; womanId: string }) => `${a.manId}-${a.womanId}`;

describe('solveMatching — constrained b-matching', () => {
	it('maximises total mutual value (picks the diagonal, not the cross)', () => {
		const men = ['m0', 'm1'], women = ['w0', 'w1'];
		const cs = [cand('m0', 'w0', 80), cand('m0', 'w1', 10), cand('m1', 'w0', 10), cand('m1', 'w1', 80)];
		const res = solveMatching(men, women, cs, caps(1, 1, 1));
		const set = new Set(res.map(key));
		expect(set.has('m0-w0')).toBe(true);
		expect(set.has('m1-w1')).toBe(true);
		expect(set.has('m0-w1')).toBe(false);
	});

	it('respects the woman cap (only the best suitor when X_w=1, no floor)', () => {
		const men = ['m0', 'm1', 'm2'], women = ['w0'];
		const cs = [cand('m0', 'w0', 90), cand('m1', 'w0', 50), cand('m2', 'w0', 30)];
		const res = solveMatching(men, women, cs, caps(0, 1, 1)); // no man floor → no forced coverage
		expect(res.length).toBe(1);
		expect(key(res[0])).toBe('m0-w0'); // highest-value suitor wins the single slot
	});

	it('respects the man cap (X_m limits how many a man gets)', () => {
		const men = ['m0'], women = ['w0', 'w1', 'w2'];
		const cs = [cand('m0', 'w0', 80), cand('m0', 'w1', 70), cand('m0', 'w2', 60)];
		const res = solveMatching(men, women, cs, caps(0, 2, 5)); // man cap 2
		expect(res.length).toBe(2);
		// takes his two best
		expect(new Set(res.map(key))).toEqual(new Set(['m0-w0', 'm0-w1']));
	});

	it('coverage fill (phase 2) gives a below-threshold man his floor', () => {
		const men = ['m0', 'm1'], women = ['w0'];
		const cs = [cand('m0', 'w0', 50), cand('m1', 'w0', 5)];
		const res = solveMatching(men, women, cs, caps(1, 1, 2), { valueThreshold: 20 });
		const m1 = res.find((r) => r.manId === 'm1');
		expect(m1).toBeTruthy();           // m1 covered despite weak value
		expect(m1!.phase).toBe(2);          // via coverage fill, flagged as starter match
		const m0 = res.find((r) => r.manId === 'm0');
		expect(m0!.phase).toBe(1);          // m0 was a quality match
	});

	it('every woman gets ≥1 match when candidates exist (no woman matchless)', () => {
		const men = ['m0', 'm1'], women = ['w0', 'w1'];
		// w1 is weak for everyone but must still get someone
		const cs = [cand('m0', 'w0', 80), cand('m1', 'w0', 75), cand('m0', 'w1', 8), cand('m1', 'w1', 6)];
		const res = solveMatching(men, women, cs, caps(1, 2, 2), { valueThreshold: 30 });
		const womenMatched = new Set(res.map((r) => r.womanId));
		expect(womenMatched.has('w1')).toBe(true);
	});

	it('assortative soft-cost prefers like-Profile-Strength pairs when values tie', () => {
		const men = ['m0', 'm1'], women = ['w0', 'w1'];
		// equal values; psGap differs: m0~w0 and m1~w1 are like-tier (gap 0),
		// the cross pairs have large gaps.
		const cs = [
			cand('m0', 'w0', 50, 0), cand('m0', 'w1', 50, 60),
			cand('m1', 'w0', 50, 60), cand('m1', 'w1', 50, 0),
		];
		const res = solveMatching(men, women, cs, caps(1, 1, 1), { lambda: 0.2 });
		const set = new Set(res.map(key));
		expect(set.has('m0-w0')).toBe(true);
		expect(set.has('m1-w1')).toBe(true);
	});

	it('handles empty input gracefully', () => {
		expect(solveMatching([], ['w0'], [], caps(1, 1, 1))).toEqual([]);
		expect(solveMatching(['m0'], [], [], caps(1, 1, 1))).toEqual([]);
	});
});

// Regression: caps used to bound one run instead of the inbox, so a nightly re-solve
// handed everyone a fresh full cap on top of what they already had. Women sat at 26
// matches against a cap of 12, and the surplus arrived as unanswered Bestie openers.
describe('solveMatching — caps are cumulative over existing matches', () => {
	it('spends only the headroom a woman has left, not her whole cap', () => {
		const men = ['m0', 'm1', 'm2'], women = ['w0'];
		const cs = [cand('m0', 'w0', 90), cand('m1', 'w0', 80), cand('m2', 'w0', 70)];
		// Cap 3, but she already holds 2 → exactly one slot remains.
		const res = solveMatching(men, women, cs, caps(0, 1, 3), { existing: { women: [2] } });
		expect(res.length).toBe(1);
		expect(key(res[0])).toBe('m0-w0'); // and it goes to her best remaining suitor
	});

	it('gives a woman already at her cap nothing at all', () => {
		const men = ['m0', 'm1'], women = ['w0'];
		const cs = [cand('m0', 'w0', 95), cand('m1', 'w0', 90)];
		const res = solveMatching(men, women, cs, caps(0, 2, 2), { existing: { women: [2] } });
		expect(res).toEqual([]);
	});

	it('counts a man’s existing matches against his cap', () => {
		const men = ['m0'], women = ['w0', 'w1', 'w2'];
		const cs = [cand('m0', 'w0', 80), cand('m0', 'w1', 70), cand('m0', 'w2', 60)];
		// Man cap 4, already on 3 → one left, not four.
		const res = solveMatching(men, women, cs, caps(0, 4, 5), { existing: { men: [3] } });
		expect(res.length).toBe(1);
		expect(key(res[0])).toBe('m0-w0');
	});

	it('the man floor is a one-time guarantee, not a nightly quota', () => {
		const men = ['m0'], women = ['w0', 'w1'];
		const cs = [cand('m0', 'w0', 5), cand('m0', 'w1', 4)]; // both below threshold
		// The women already have someone, so the "no woman matchless" rule stays out
		// of it and the man floor is the only thing that could fire.
		const womenHeld = { women: [1, 1] };
		// He is already matched once: the floor is satisfied, so nothing re-fires.
		const covered = solveMatching(men, women, cs, caps(1, 4, 4), {
			valueThreshold: 20, existing: { men: [1], ...womenHeld },
		});
		expect(covered).toEqual([]);
		// Genuinely unmatched: the floor still earns him his first match.
		const uncovered = solveMatching(men, women, cs, caps(1, 4, 4), {
			valueThreshold: 20, existing: { men: [0], ...womenHeld },
		});
		expect(uncovered.length).toBe(1);
		expect(uncovered[0].phase).toBe(2);
	});

	it('coverage does not re-fire for a woman who already has someone', () => {
		const men = ['m0'], women = ['w0'];
		const cs = [cand('m0', 'w0', 3)]; // below threshold, only reachable via coverage
		const res = solveMatching(men, women, cs, caps(0, 4, 4), {
			valueThreshold: 20, existing: { women: [1] },
		});
		expect(res).toEqual([]);
	});

	it('treats a missing or zero existing count as a full cap (back-compat)', () => {
		const men = ['m0', 'm1'], women = ['w0'];
		const cs = [cand('m0', 'w0', 90), cand('m1', 'w0', 80)];
		const withOut = solveMatching(men, women, cs, caps(0, 1, 2));
		const withZero = solveMatching(men, women, cs, caps(0, 1, 2), { existing: { women: [0] } });
		expect(withOut.length).toBe(2);
		expect(withZero.map(key).sort()).toEqual(withOut.map(key).sort());
	});
});
