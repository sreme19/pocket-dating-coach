/**
 * aibestie-prompt.test.ts
 *
 * Two things this block exists to prevent, both seen in a real run:
 *
 *  · she ended the FINAL turn on a question the composer had just locked him out
 *    of answering, so the conversation died on a dead line;
 *  · she is otherwise free to invite a proof upload, on a page with no attachment
 *    control — an instruction he physically cannot follow.
 *
 * And the standing rule from aibestie-owner.ts: an unstaffed profile may never
 * claim a person is reading.
 */

import { describe, it, expect } from 'vitest';
import { buildLpConversationBlock, isFinalTurn } from '../aibestie-prompt';

const staffed = { turnsUsed: 5, maxTurns: 5, terminus: 'human' as const, ownerName: 'Linda' };
const unstaffed = { ...staffed, terminus: 'artifact' as const };
const midway = { ...unstaffed, turnsUsed: 2 };
const penultimate = { ...unstaffed, turnsUsed: 4 };

describe('isFinalTurn', () => {
	it('is true on and past the budget', () => {
		expect(isFinalTurn({ turnsUsed: 5, maxTurns: 5 })).toBe(true);
		expect(isFinalTurn({ turnsUsed: 6, maxTurns: 5 })).toBe(true);
	});
	it('is false before it', () => {
		expect(isFinalTurn({ turnsUsed: 4, maxTurns: 5 })).toBe(false);
	});
});

describe('every turn', () => {
	it('forbids asking for uploads, on every turn', () => {
		for (const ctx of [midway, penultimate, unstaffed]) {
			const b = buildLpConversationBlock(ctx).toLowerCase();
			expect(b).toContain('cannot upload');
			expect(b).toMatch(/never ask for a photo/);
		}
	});

	it('forbids mentioning the hand-off machinery', () => {
		const b = buildLpConversationBlock(midway).toLowerCase();
		expect(b).toContain('never mention a checklist');
		expect(b).toContain('taking it from here');
	});

	it('tells her he never swiped or matched', () => {
		// A real run opened with "what made you swipe on Linda's profile?" — he tapped
		// an advert. Asking why he swiped implies a flow he was never in and makes her
		// sound like she is reading someone else's conversation.
		const b = buildLpConversationBlock(midway);
		expect(b).toMatch(/did NOT swipe, like, or match/);
		expect(b).toMatch(/tapped an advert/);
	});

	it('says he has no profile, and that this is not evasiveness', () => {
		// Without this she reads the blanks as him dodging and the tone curdles.
		const b = buildLpConversationBlock(midway).toLowerCase();
		expect(b).toContain('has not signed up');
		expect(b).toMatch(/do not treat the blanks as evasiveness/);
	});
});

describe('the final turn', () => {
	it('forbids a question', () => {
		const b = buildLpConversationBlock(unstaffed);
		expect(b).toContain('LAST MESSAGE');
		expect(b).toMatch(/Do NOT ask a question/);
	});

	it('demands a compliment built from what he actually said', () => {
		const b = buildLpConversationBlock(unstaffed);
		expect(b).toMatch(/TRUE compliment/);
		expect(b).toMatch(/Never generic praise/);
	});

	it('never claims a person is reading when the owner is unstaffed', () => {
		const b = buildLpConversationBlock(unstaffed);
		expect(b).toMatch(/Do NOT say Linda is about to read it or reply/);
		expect(b).toContain('goes onto his profile');
	});

	it('claims she reads them when a human IS behind the profile — but not WHEN', () => {
		const b = buildLpConversationBlock(staffed);
		expect(b).toContain('reads these herself');
		// Reading is a commitment she made. A reply time is not, and an invented one
		// is a promise the product then has to keep.
		expect(b).toMatch(/do NOT quote any timeframe/i);
	});

	it('does not narrate the button', () => {
		// It is rendered directly beneath her message; describing it reads as an ad.
		expect(buildLpConversationBlock(unstaffed)).toMatch(/Do NOT describe the button/);
	});
});

describe('the turn before last', () => {
	it('warns her not to open a topic she cannot finish', () => {
		const b = buildLpConversationBlock(penultimate);
		expect(b).toContain('SECOND-TO-LAST');
		expect(b).not.toContain('LAST MESSAGE IN THIS CONVERSATION');
	});

	it('leaves earlier turns unhurried', () => {
		const b = buildLpConversationBlock(midway);
		expect(b).toContain('no rush');
		expect(b).not.toContain('SECOND-TO-LAST');
	});
});
