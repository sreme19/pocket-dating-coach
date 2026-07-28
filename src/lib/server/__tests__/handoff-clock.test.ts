import { describe, it, expect } from 'vitest';
import {
	computeHandoffClock,
	hoursLabel,
	HANDOFF_TIMEOUT_HOURS
} from '../handoff-clock';
import { buildHandoffPhaseBlock } from '../bestie-checklist';

const WRAP = '2026-07-27T16:49:52.000Z';
const at = (hoursAfterWrap: number) => Date.parse(WRAP) + hoursAfterWrap * 3_600_000;

describe('computeHandoffClock', () => {
	it('reports elapsed and remaining hours inside the window', () => {
		const c = computeHandoffClock(WRAP, at(24.5))!;
		expect(c.elapsedHours).toBe(24);
		expect(c.remainingHours).toBe(23);
		expect(c.expired).toBe(false);
		expect(c.expiresAt).toBe(new Date(at(HANDOFF_TIMEOUT_HOURS)).toISOString());
	});

	it('FLOORS remaining hours so it can never over-promise time he does not have', () => {
		// 47.6h elapsed → 0.4h actually left. Rounding up to "1 hour" would be a
		// promise the cron is about to break.
		expect(computeHandoffClock(WRAP, at(47.6))!.remainingHours).toBe(0);
	});

	it('clamps remaining at zero and flags expiry past the window', () => {
		const c = computeHandoffClock(WRAP, at(60))!;
		expect(c.remainingHours).toBe(0);
		expect(c.expired).toBe(true);
		expect(c.elapsedHours).toBe(60);
	});

	it('never reports negative elapsed time for a clock skewed into the future', () => {
		expect(computeHandoffClock(WRAP, at(-5))!.elapsedHours).toBe(0);
	});

	it('returns null for a missing or unparseable wrapped_at (no clock to talk about)', () => {
		expect(computeHandoffClock(null)).toBeNull();
		expect(computeHandoffClock(undefined)).toBeNull();
		expect(computeHandoffClock('not a date')).toBeNull();
	});
});

describe('hoursLabel', () => {
	it('reads naturally at the boundaries', () => {
		expect(hoursLabel(0)).toBe('under an hour');
		expect(hoursLabel(-2)).toBe('under an hour');
		expect(hoursLabel(1)).toBe('1 hour');
		expect(hoursLabel(23)).toBe('23 hours');
	});
});

describe('buildHandoffPhaseBlock', () => {
	// The regression this whole module exists for: on 2026-07-28 a waiting man asked
	// "let me know if she will be joining the chat or should I give up?" and Bestie
	// replied "She's joining today, promise. Life got in the way but she's absolutely
	// still interested." She had not opened the app in 27 hours.
	const clock = computeHandoffClock(WRAP, at(24.5));

	it('gives Bestie the real numbers to quote', () => {
		const block = buildHandoffPhaseBlock('Shalini', 'Rishav', clock);
		expect(block).toContain('24 hours ago');
		expect(block).toContain('23 hours left');
		expect(block).toContain(`${HANDOFF_TIMEOUT_HOURS}-hour window`);
		// He must be told the downside is covered — that's what makes waiting rational.
		expect(block).toContain('fresh match');
	});

	it('forbids inventing her timeline, her reasons, or her interest', () => {
		const block = buildHandoffPhaseBlock('Shalini', 'Rishav', clock);
		expect(block).toContain('NEVER SPEAK FOR SHALINI');
		for (const banned of [
			'joining today',
			'stepping in now',
			'about to reply',
			'still interested',
			'life got in the way'
		]) {
			expect(block).toContain(banned);
		}
		expect(block).toContain('You may NEVER state what SHE is going to do');
	});

	it('still bans speaking for her when there is no clock at all', () => {
		const block = buildHandoffPhaseBlock('Shalini', 'Rishav', null);
		expect(block).toContain('NEVER SPEAK FOR SHALINI');
		expect(block).not.toContain('HAND-OFF CLOCK');
		// Without facts she must decline to guess rather than reassure.
		expect(block).toContain("I genuinely don't know her timing");
	});

	it('keeps the pre-existing reactive-mode rules', () => {
		const block = buildHandoffPhaseBlock('Shalini', 'Rishav', clock);
		expect(block).toContain('HAND-OFF PHASE');
		expect(block).toContain('Let HIM lead');
		expect(block).toContain('do NOT end your message with a question');
	});
});
