import { describe, it, expect } from 'vitest';
import { buildHerInbox, MIN_SURFACED, type SuitorInput } from '../her-inbox';
import type { Vec } from '../vector-scoring';

// She cares most about lifestyle, then presentation. Financial is weighted but must
// never be what orders her list.
const her: Vec = {
	lifestyle: 0.28, presentation: 0.22, financial: 0.18, ambition: 0.12,
	social_legitimacy: 0.10, warmth: 0.05, humor: 0.03, intellect: 0.01, family: 0.005, looks: 0.005,
};
const attrs = (o: Partial<Vec> = {}): Vec => ({
	lifestyle: 60, presentation: 60, financial: 60, ambition: 60, social_legitimacy: 60,
	warmth: 60, humor: 60, intellect: 60, family: 60, looks: 60, ...o,
});
const conf = (o: Partial<Vec> = {}): Vec => ({
	lifestyle: 0.3, presentation: 0.3, financial: 0.3, ambition: 0.3, social_legitimacy: 0.3,
	warmth: 0.3, humor: 0.3, intellect: 0.3, family: 0.3, looks: 0.3, ...o,
});
const s = (over: Partial<SuitorInput>): SuitorInput => ({
	matchId: 'm', manId: 'u', firstName: 'Man', attrs: attrs(), conf: conf(),
	gapBarPercent: 50, wrapped: false, waitingOnHim: false, ...over,
});

describe('buildHerInbox', () => {
	it('orders by APPEAL, not by the gap bar', () => {
		// The point of the whole design: a man at 61% who has proven what she cares
		// about must beat a man at 95% who has proven things she does not.
		const provenWhatSheWants = s({
			matchId: 'a', firstName: 'Fits', gapBarPercent: 61,
			conf: conf({ lifestyle: 1, presentation: 1 }),
		});
		const provenOtherThings = s({
			matchId: 'b', firstName: 'Thorough', gapBarPercent: 95,
			conf: conf({ intellect: 1, humor: 1, family: 1, looks: 1 }),
		});
		const box = buildHerInbox(her, [provenOtherThings, provenWhatSheWants]);
		const order = [...box.ready, ...box.vetting].map((r) => r.firstName);
		expect(order[0]).toBe('Fits');
	});

	it('never exposes his percentage to her', () => {
		const box = buildHerInbox(her, [s({ gapBarPercent: 73 })]);
		const row = [...box.ready, ...box.vetting][0];
		expect(Object.keys(row)).not.toContain('gapBarPercent');
		expect(JSON.stringify(row)).not.toContain('73');
	});

	it('puts men past the threshold in ready', () => {
		const box = buildHerInbox(her, [
			s({ matchId: 'a', firstName: 'A', gapBarPercent: 94, wrapped: true }),
			s({ matchId: 'b', firstName: 'B', gapBarPercent: 91, wrapped: true }),
			s({ matchId: 'c', firstName: 'C', gapBarPercent: 90, wrapped: true }),
		]);
		expect(box.ready).toHaveLength(3);
		expect(box.vetting).toHaveLength(0);
	});

	it('requires BOTH a wrap and the threshold — talk alone is not ready', () => {
		const box = buildHerInbox(her, [s({ gapBarPercent: 95, wrapped: false })]);
		// Topped up into ready (see below), but not because he was ready.
		expect(box.ready[0].ready).toBe(false);
	});

	it('tops up to three so her list is never empty', () => {
		// The soft gate: it promotes a man into her attention, it never withholds one.
		// An empty "ready for you" is how she learns to stop opening the tab.
		const box = buildHerInbox(her, [
			s({ matchId: 'a', firstName: 'A', gapBarPercent: 40 }),
			s({ matchId: 'b', firstName: 'B', gapBarPercent: 38 }),
			s({ matchId: 'c', firstName: 'C', gapBarPercent: 30 }),
			s({ matchId: 'd', firstName: 'D', gapBarPercent: 20 }),
		]);
		expect(box.ready).toHaveLength(MIN_SURFACED);
		expect(box.vetting).toHaveLength(1);
		expect(box.ready.every((r) => r.ready === false)).toBe(true);
	});

	it('does not invent men to top up with', () => {
		const box = buildHerInbox(her, [s({ matchId: 'a' })]);
		expect(box.ready).toHaveLength(1);
		expect(box.totalSuitors).toBe(1);
	});

	it('sinks a man who owes her an answer, into his own section', () => {
		const box = buildHerInbox(her, [
			s({ matchId: 'a', firstName: 'Here', gapBarPercent: 92, wrapped: true }),
			s({ matchId: 'b', firstName: 'Ghost', waitingOnHim: true, conf: conf({ lifestyle: 1, presentation: 1 }) }),
		]);
		expect(box.waiting.map((r) => r.firstName)).toEqual(['Ghost']);
		expect([...box.ready, ...box.vetting].map((r) => r.firstName)).not.toContain('Ghost');
	});

	it('ranks 1..n with no shared numbers', () => {
		const box = buildHerInbox(her, [
			s({ matchId: 'a', conf: conf({ lifestyle: 1 }) }),
			s({ matchId: 'b', conf: conf({ lifestyle: 1 }) }), // identical appeal
			s({ matchId: 'c', conf: conf({ lifestyle: 1 }) }),
		]);
		const ranks = [...box.ready, ...box.vetting].map((r) => r.rank).sort();
		expect(ranks).toEqual([1, 2, 3]);
	});

	it('states what is unproven neutrally, never as a warning', () => {
		const box = buildHerInbox(her, [
			s({ matchId: 'a', conf: conf({ presentation: 1, financial: 1, ambition: 1, social_legitimacy: 1 }) }),
		]);
		expect(box.ready[0].unprovenNote).toBe('lifestyle unproven');
	});

	it('calls a mostly-unproven portfolio thin rather than listing failures', () => {
		const box = buildHerInbox(her, [s({ matchId: 'a', conf: conf() })]);
		expect(box.ready[0].unprovenNote).toBe('portfolio thin');
	});

	it('says nothing when there is nothing outstanding', () => {
		const allProven = Object.fromEntries(Object.keys(conf()).map((k) => [k, 1])) as Vec;
		const box = buildHerInbox(her, [s({ matchId: 'a', conf: allProven })]);
		expect(box.ready[0].unprovenNote).toBeNull();
	});

	it('names income plainly when she weights it, without dressing it up', () => {
		// She is entitled to know a claim is unproven. It is simply never framed as
		// making him more or less desirable, and Bestie never chases him for it.
		const box = buildHerInbox(her, [
			s({ matchId: 'a', conf: conf({ lifestyle: 1, presentation: 1, ambition: 1, social_legitimacy: 1 }) }),
		]);
		expect(box.ready[0].unprovenNote).toBe('income unproven');
	});

	it('does not fabricate an order when she has no distilled preferences', () => {
		const given = [
			s({ matchId: 'a', firstName: 'First' }),
			s({ matchId: 'b', firstName: 'Second' }),
		];
		const box = buildHerInbox(null, given);
		expect([...box.ready].map((r) => r.firstName)).toEqual(['First', 'Second']);
		expect(box.ready.every((r) => r.appeal === 0)).toBe(true);
	});

	it('handles a man with no vectors at all', () => {
		const box = buildHerInbox(her, [s({ matchId: 'a', attrs: null, conf: null })]);
		expect(box.ready[0].unprovenNote).toBe('nothing verified yet');
	});

	it('handles an empty pool', () => {
		const box = buildHerInbox(her, []);
		expect(box).toEqual({ ready: [], vetting: [], waiting: [], totalSuitors: 0 });
	});
});

describe('buildHerInbox — hard mismatch (G-2)', () => {
	it('lets the mismatch take over the note', () => {
		const box = buildHerInbox(her, [
			s({ matchId: 'a', fitMismatch: "he says he isn't looking for a relationship right now" }),
		]);
		expect(box.ready[0].unprovenNote).toBe("he says he isn't looking for a relationship right now");
	});

	it('still shows him to her — a mismatch is her decision, not a removal', () => {
		// Deliberately not an auto-unmatch. This is a model judgement, and the same model
		// once accused a blameless man nine times of something he never said.
		const box = buildHerInbox(her, [
			s({ matchId: 'a', firstName: 'Mismatched', fitMismatch: 'wants something casual' }),
			s({ matchId: 'b', firstName: 'Fine' }),
		]);
		const everyone = [...box.ready, ...box.vetting, ...box.waiting].map((r) => r.firstName);
		expect(everyone).toContain('Mismatched');
	});

	it('falls back to the unproven note when there is no mismatch', () => {
		const box = buildHerInbox(her, [s({ matchId: 'a', fitMismatch: null })]);
		expect(box.ready[0].unprovenNote).toBe('portfolio thin');
	});
});
