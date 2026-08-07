/**
 * aibestie-bar.test.ts
 *
 * The property that matters most is the CAP, and it is not a styling choice. The
 * real in-app bar is monotonic by design — it never drops for anything he did not
 * do — so if this bar could exceed what the app computes for a claim-free man
 * (40%), every visitor would watch his number fall the moment he installed. The
 * cap sits below that floor so the transition is always upward.
 *
 * Second is that the bar MOVES. A checklist holds 2–5 items across a 5-turn
 * conversation and buildChecklist returns null below two, so an items-only score
 * would sit frozen at 0 through an entire visit and the page would ship a
 * progress indicator that does not indicate progress.
 */

import { describe, it, expect } from 'vitest';
import {
	computeLpBar,
	isSubstantive,
	LP_BAR_MAX,
	POINTS_PER_ITEM,
	POINTS_PER_TURN
} from '../aibestie-bar';
import type { BestieChecklist } from '../bestie-checklist';

function checklist(done: number, total: number): BestieChecklist {
	return {
		items: Array.from({ length: total }, (_, i) => ({
			id: `i${i}`,
			label: `item ${i}`,
			status: i < done ? ('done' as const) : ('open' as const),
			done_at: null
		})),
		status: 'active',
		created_at: '2026-08-07T00:00:00Z',
		wrapped_at: null
	};
}

describe('the cap', () => {
	it('never exceeds LP_BAR_MAX, however much he does', () => {
		const bar = computeLpBar({ checklist: checklist(5, 5), substantiveTurns: 5 });
		// 5*4 + 5*1 = 25 raw, which must not surface.
		expect(bar.percent).toBe(LP_BAR_MAX);
		expect(bar.capped).toBe(true);
	});

	it('stays below the 40% a claim-free man scores in the app', () => {
		// gap-bar.ts: fit 10 + portfolio 0 + standout 0 + corroboration 30 = 40.
		// Exceeding that would make the in-app bar fall on his first open, breaking
		// the monotonic guarantee the whole gap-bar design rests on.
		expect(LP_BAR_MAX).toBeLessThan(40);
	});

	it('reports no next step once capped', () => {
		const bar = computeLpBar({ checklist: checklist(5, 5), substantiveTurns: 5 });
		expect(bar.nextLabel).toBeNull();
	});
});

describe('movement', () => {
	it('starts at zero', () => {
		expect(computeLpBar({ checklist: null, substantiveTurns: 0 }).percent).toBe(0);
	});

	it('moves on every substantive turn even with no checklist at all', () => {
		// buildChecklist returns null below 2 items, which is a live possibility for
		// a man with no profile to generate items from. An items-only score would
		// leave the bar frozen at 0 for the whole conversation.
		const seen = [0, 1, 2, 3, 4, 5].map(
			(t) => computeLpBar({ checklist: null, substantiveTurns: t }).percent
		);
		expect(seen).toEqual([0, 1, 2, 3, 4, 5]);
	});

	it('weights an answered item well above a turn', () => {
		expect(POINTS_PER_ITEM).toBeGreaterThan(POINTS_PER_TURN * 2);
		const item = computeLpBar({ checklist: checklist(1, 3), substantiveTurns: 0 });
		const turn = computeLpBar({ checklist: checklist(0, 3), substantiveTurns: 1 });
		expect(item.percent).toBeGreaterThan(turn.percent);
	});

	it('reaches a visible number over a realistic 5-turn visit', () => {
		// 3 items answered across 5 substantive turns — the expected good case.
		const bar = computeLpBar({ checklist: checklist(3, 4), substantiveTurns: 5 });
		expect(bar.percent).toBe(17);
		expect(bar.capped).toBe(false);
	});
});

describe('monotonicity', () => {
	it('never falls below what he was already shown', () => {
		// He must not watch the number drop mid-conversation — that turns Bestie's
		// questions into a visible exam.
		const bar = computeLpBar({ checklist: null, substantiveTurns: 0, previousPercent: 12 });
		expect(bar.percent).toBe(12);
	});

	it('still honours the cap when the stored floor is higher', () => {
		const bar = computeLpBar({ checklist: null, substantiveTurns: 0, previousPercent: 95 });
		expect(bar.percent).toBe(LP_BAR_MAX);
	});
});

describe('segments', () => {
	it('keeps the real bar geometry so the page is the same control', () => {
		const bar = computeLpBar({ checklist: null, substantiveTurns: 0 });
		expect(bar.stages.map((s) => s.weight)).toEqual([10, 30, 30, 30]);
		expect(bar.stages.map((s) => s.id)).toEqual([
			'fit',
			'portfolio',
			'standout',
			'corroboration'
		]);
	});

	it('fills left to right out of one budget', () => {
		const bar = computeLpBar({ checklist: checklist(3, 4), substantiveTurns: 5 }); // 17
		expect(bar.stages[0].earned).toBe(10); // fit full
		expect(bar.stages[1].earned).toBe(7); // portfolio partial
		expect(bar.stages[2].earned).toBe(0);
		expect(bar.stages[3].earned).toBe(0);
	});

	it('earns no more than each stage weight', () => {
		const bar = computeLpBar({ checklist: checklist(5, 5), substantiveTurns: 5 });
		for (const s of bar.stages) expect(s.earned).toBeLessThanOrEqual(s.weight);
	});
});

describe('isSubstantive', () => {
	it('rejects a shrug', () => {
		expect(isSubstantive('k')).toBe(false);
		expect(isSubstantive('hi')).toBe(false);
		expect(isSubstantive('   ')).toBe(false);
	});

	it('accepts a real answer', () => {
		expect(isSubstantive('Moved to Bangalore last year for work')).toBe(true);
	});
});
