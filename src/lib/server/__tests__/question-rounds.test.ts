import { describe, it, expect } from 'vitest';
import {
	MAX_ROUNDS, roundsRemaining, isFinalRound, canAskMore,
	reopenWithQuestions, screenFreeText, buildQuestionRoundBlock
} from '../question-rounds';
import type { BestieChecklist } from '../bestie-checklist';

const wrapped: BestieChecklist = {
	items: [
		{ id: 'a', label: 'what he wants', status: 'done', done_at: '2026-08-01T00:00:00Z' },
		{ id: 'b', label: 'his week', status: 'done', done_at: '2026-08-01T00:00:00Z' },
	],
	status: 'wrapped',
	created_at: '2026-07-30T00:00:00Z',
	wrapped_at: '2026-08-01T00:00:00Z',
	rev: 4,
};

describe('rounds', () => {
	it('allows two per match and no more', () => {
		expect(roundsRemaining(0)).toBe(MAX_ROUNDS);
		expect(roundsRemaining(1)).toBe(1);
		expect(roundsRemaining(2)).toBe(0);
		expect(roundsRemaining(99)).toBe(0);
		expect(roundsRemaining(null)).toBe(MAX_ROUNDS);
	});

	it('knows when the next one is the last', () => {
		expect(isFinalRound(0)).toBe(false);
		expect(isFinalRound(1)).toBe(true);
		expect(isFinalRound(2)).toBe(false); // none left at all
	});
});

describe('canAskMore', () => {
	const ok = { bestieActive: true, checklistStatus: 'wrapped', roundsUsed: 0, status: 'mutual' };

	it('allows it while Bestie is the proxy on a wrapped checklist', () => {
		expect(canAskMore(ok).allowed).toBe(true);
	});

	it('refuses once she has taken over, and says why', () => {
		const r = canAskMore({ ...ok, bestieActive: false });
		expect(r.allowed).toBe(false);
		expect(r.reason).toMatch(/ask him/i);
	});

	it('refuses before Bestie has finished vetting', () => {
		expect(canAskMore({ ...ok, checklistStatus: 'active' }).allowed).toBe(false);
	});

	it('refuses on an inactive match', () => {
		expect(canAskMore({ ...ok, status: 'expired' }).allowed).toBe(false);
	});

	it('refuses after both rounds, without blaming him', () => {
		const r = canAskMore({ ...ok, roundsUsed: 2 });
		expect(r.allowed).toBe(false);
		expect(r.reason).toMatch(/interview/i);
	});
});

describe('reopenWithQuestions', () => {
	it('appends her questions and reopens the checklist', () => {
		const next = reopenWithQuestions(wrapped, [
			{ id: 'family', label: 'his family and roots' },
			{ id: 'conflict', label: 'how he handles conflict' },
		])!;
		expect(next.status).toBe('active');
		expect(next.items).toHaveLength(4);
		expect(next.items.slice(2).every((i) => i.status === 'open')).toBe(true);
	});

	it('clears wrapped_at, which is what suspends the 48h clock', () => {
		// The clock is derived from wrapped_at, so there is no separate pause state that
		// could disagree with it. A fresh 48h starts when Bestie wraps again.
		const next = reopenWithQuestions(wrapped, [{ id: 'x', label: 'something' }])!;
		expect(next.wrapped_at).toBeNull();
	});

	it('bumps rev so a concurrent turn cannot lose it', () => {
		expect(reopenWithQuestions(wrapped, [{ id: 'x', label: 'x' }])!.rev).toBe(5);
	});

	it('keeps her answered items answered', () => {
		const next = reopenWithQuestions(wrapped, [{ id: 'x', label: 'x' }])!;
		expect(next.items.filter((i) => i.status === 'done')).toHaveLength(2);
	});

	it('does NOT cap her questions at CHECKLIST_MAX_ITEMS', () => {
		// The cap keeps Bestie's OWN generated checklist legible. These are items the
		// owner explicitly chose, and silently dropping her seventh would be worse than
		// a long list — she would believe it had been asked.
		const many = Array.from({ length: 9 }, (_, i) => ({ id: `q${i}`, label: `question ${i}` }));
		const next = reopenWithQuestions(wrapped, many)!;
		expect(next.items).toHaveLength(11);
	});

	it('never asks the same thing twice', () => {
		const next = reopenWithQuestions(wrapped, [{ id: 'a', label: 'what he wants' }]);
		expect(next).toBeNull(); // 'a' is already there, so there is nothing new to ask
	});

	it('returns null with nothing to add or no checklist', () => {
		expect(reopenWithQuestions(wrapped, [])).toBeNull();
		expect(reopenWithQuestions(null, [{ id: 'x', label: 'x' }])).toBeNull();
	});
});

describe('screenFreeText', () => {
	it('lets an ordinary question through', () => {
		const v = screenFreeText('Ask him why his last relationship ended.');
		expect(v.allowed).toBe(true);
		expect(v.refusal).toBeNull();
	});

	it('declines money questions and offers the nearest real thing', () => {
		for (const q of ['find out what he actually earns', 'is he rich?', 'ask for his payslip', "what's his net worth"]) {
			const v = screenFreeText(q);
			expect(v.allowed, q).toBe(false);
			expect(v.refusal).toMatch(/fraud check/i);
			expect(v.alternative).toMatch(/building toward/i);
		}
	});

	it('declines to hand over her contact details', () => {
		const v = screenFreeText('give him my whatsapp number');
		expect(v.allowed).toBe(false);
		expect(v.alternative).toBeTruthy();
	});

	it('declines sexual questions without lecturing her', () => {
		const v = screenFreeText('ask what he likes in bed');
		expect(v.allowed).toBe(false);
		expect(v.refusal!.length).toBeLessThan(120);
	});

	it('always pairs a refusal with an alternative — a no is never a dead end', () => {
		for (const q of ['what does he earn', 'send him my insta', 'body count?']) {
			const v = screenFreeText(q);
			expect(v.allowed).toBe(false);
			expect(v.alternative, q).toBeTruthy();
		}
	});

	it('handles empty input', () => {
		expect(screenFreeText('').allowed).toBe(true);
	});
});

describe('buildQuestionRoundBlock', () => {
	const base = { userName: 'Shalini', matchName: 'Rishav', topics: ['his family'], freeText: null, finalRound: false };

	it('tells her what she DID, and bars what she feels', () => {
		const b = buildQuestionRoundBlock(base);
		expect(b).toMatch(/read everything/i);
		expect(b).toMatch(/never how she feels/i);
		expect(b).toMatch(/may NOT say she is interested/i);
	});

	it('bars predicting that she will reply', () => {
		expect(buildQuestionRoundBlock(base)).toMatch(/[Nn]ever predict/);
	});

	it('carries her own words as material, not as a quote to read out', () => {
		const b = buildQuestionRoundBlock({ ...base, freeText: 'why did it end' });
		expect(b).toContain('why did it end');
		expect(b).toMatch(/not as a quotation/i);
	});

	it('announces the last round unprompted', () => {
		const b = buildQuestionRoundBlock({ ...base, finalRound: true });
		expect(b).toMatch(/LAST TIME/i);
		expect(b).toMatch(/rather than an apology/i);
	});

	it('says nothing about a limit when one remains', () => {
		expect(buildQuestionRoundBlock(base)).not.toMatch(/LAST TIME/i);
	});

	it('still fires the final-round notice when she only used free text', () => {
		const b = buildQuestionRoundBlock({ ...base, topics: [], freeText: 'one thing', finalRound: true });
		expect(b).toMatch(/LAST TIME/i);
	});

	it('keeps her pacing rules — never a list, never stacked questions', () => {
		expect(buildQuestionRoundBlock(base)).toMatch(/never more than one question/i);
	});
});
