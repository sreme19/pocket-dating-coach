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

describe('crude ad traffic', () => {
	// Paid clicks off an advert that showed a woman are not the in-app population.
	// A share of them open sexually, and the model's two instincts — lecture him, or
	// play along — are both wrong for a page that has to convert AND stay honest.

	it('is in force on every turn, including the last', () => {
		// His first message is the one most likely to need it, but nothing stops him
		// turning on the final turn either.
		for (const ctx of [midway, penultimate, unstaffed, staffed]) {
			expect(buildLpConversationBlock(ctx)).toMatch(/SEXUAL, CRUDE/);
		}
	});

	it('forbids both lecturing him and playing along', () => {
		const b = buildLpConversationBlock(midway);
		expect(b).toMatch(/Do NOT lecture, moralise, scold/);
		expect(b).toMatch(/Do NOT play along, flirt back/);
	});

	it('forbids declining on the owner’s behalf, not just speaking for her', () => {
		// The trap: "she's not into that" LOOKS like the diplomatic answer and is the
		// worst line available — an invented claim about a real woman's preferences,
		// on a profile where nobody is behind the account to have said it.
		const b = buildLpConversationBlock(midway);
		expect(b).toMatch(/NEVER answer for Linda/);
		expect(b).toMatch(/still you putting words in a real person's mouth/);
	});

	it('rests the refusal on what is true of HIM', () => {
		// The only honest ground available: he has verified nothing. Stated without
		// edge, it is where every man here started rather than an accusation.
		const b = buildLpConversationBlock(midway);
		expect(b).toMatch(/nobody knows a thing about him/);
		expect(b).toMatch(/not an accusation/);
	});

	it('names the sign-up control exactly as it appears on screen', () => {
		const b = buildLpConversationBlock(midway);
		expect(b).toContain('TOP RIGHT');
		expect(b).toContain('"Continue"');
	});

	it('does not point at the header button on the final turn', () => {
		// A full-width store button is rendered directly beneath that message; sending
		// him to a different control in the header would send him to the wrong place.
		const b = buildLpConversationBlock(unstaffed);
		expect(b).toMatch(/SEXUAL, CRUDE/);
		expect(b).not.toContain('TOP RIGHT');
	});

	it('tells her to go quiet rather than escalate on a repeat', () => {
		expect(buildLpConversationBlock(midway)).toMatch(/do not repeat the point or escalate/);
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

	it('lets her skip the compliment when he gave her nothing', () => {
		// "Open with a TRUE compliment" and a man who was crude for five turns is an
		// instruction with no honest answer, so she would manufacture one — the single
		// line in that message he is most likely to catch.
		const b = buildLpConversationBlock(unstaffed);
		expect(b).toMatch(/do not invent one/);
		expect(b).toMatch(/Skip the compliment entirely/);
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
