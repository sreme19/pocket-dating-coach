import { describe, it, expect } from 'vitest';
import {
	shouldAskConsent,
	nextOpportunityCounters,
	applyConsentAnswer,
	overlappingTopics,
	buildLedgerBlock,
	buildChecklistSuppressionBlock,
	CONSENT_DECLINE_SOFT_CAP,
	CONSENT_ASK_EVERY,
	type ConsentState,
	type LedgerEntry
} from '../bestie-ledger';

const state = (over: Partial<ConsentState> = {}): ConsentState => ({
	consent: 'unasked',
	declines: 0,
	opportunitiesSinceAsk: 0,
	...over
});

const entry = (topic: string, answer: string, daysAgo = 1): LedgerEntry => ({
	topic,
	answer,
	created_at: new Date(Date.now() - daysAgo * 86_400_000).toISOString()
});

describe('shouldAskConsent — when Bestie raises it', () => {
	it('asks when her checklist overlaps something he has answered', () => {
		expect(shouldAskConsent({ state: state(), hasOpportunity: true, askedInThisThread: false })).toBe(true);
	});

	it('THE POINT: stays silent with no overlap — consent buys him nothing yet', () => {
		expect(shouldAskConsent({ state: state(), hasOpportunity: false, askedInThisThread: false })).toBe(false);
	});

	it('never asks twice in one thread, even across many turns', () => {
		expect(shouldAskConsent({ state: state(), hasOpportunity: true, askedInThisThread: true })).toBe(false);
	});

	it('never asks a man who already said yes', () => {
		const s = state({ consent: 'granted' });
		expect(shouldAskConsent({ state: s, hasOpportunity: true, askedInThisThread: false })).toBe(false);
	});

	it('a previous decline does not stop the NEXT Bestie asking', () => {
		// Consent is global but each new Bestie gets her own ask until the cap.
		const s = state({ consent: 'declined', declines: 1 });
		expect(shouldAskConsent({ state: s, hasOpportunity: true, askedInThisThread: false })).toBe(true);
	});
});

describe('shouldAskConsent — the decline cadence', () => {
	it(`asks freely up to ${CONSENT_DECLINE_SOFT_CAP} declines`, () => {
		const s = state({ consent: 'declined', declines: CONSENT_DECLINE_SOFT_CAP - 1 });
		expect(shouldAskConsent({ state: s, hasOpportunity: true, askedInThisThread: false })).toBe(true);
	});

	it('goes quiet on the very next opportunity once he has hit the cap', () => {
		const s = state({ consent: 'declined', declines: CONSENT_DECLINE_SOFT_CAP, opportunitiesSinceAsk: 0 });
		expect(shouldAskConsent({ state: s, hasOpportunity: true, askedInThisThread: false })).toBe(false);
	});

	it(`comes back on every ${CONSENT_ASK_EVERY}th opportunity, not every ${CONSENT_ASK_EVERY}th thread`, () => {
		const s = state({
			consent: 'declined',
			declines: CONSENT_DECLINE_SOFT_CAP,
			opportunitiesSinceAsk: CONSENT_ASK_EVERY - 1
		});
		expect(shouldAskConsent({ state: s, hasOpportunity: true, askedInThisThread: false })).toBe(true);
	});

	it('counts the opportunity even on turns it stays quiet', () => {
		expect(nextOpportunityCounters(state({ opportunitiesSinceAsk: 2 }), false).opportunitiesSinceAsk).toBe(3);
	});

	it('resets the counter on a turn that asked', () => {
		expect(nextOpportunityCounters(state({ opportunitiesSinceAsk: 4 }), true).opportunitiesSinceAsk).toBe(0);
	});

	it('THE BUG: an opportunity is one per THREAD, not one per message', () => {
		// The counter is what makes "every 5th opportunity" mean anything. If a
		// long conversation counted each turn, a man past the cap would race
		// through five "opportunities" inside one chat and be asked again in the
		// next thread — i.e. back to being asked constantly, which is what the cap
		// exists to stop. The responder spends the opportunity once, by stamping
		// the thread marker, and askedInThisThread then closes the door.
		let s = state({ consent: 'declined', declines: CONSENT_DECLINE_SOFT_CAP, opportunitiesSinceAsk: 0 });
		// Turn 1 of the thread: opportunity spent, cadence says stay quiet.
		expect(shouldAskConsent({ state: s, hasOpportunity: true, askedInThisThread: false })).toBe(false);
		s = { ...s, ...nextOpportunityCounters(s, false) };
		expect(s.opportunitiesSinceAsk).toBe(1);
		// Turns 2..N of the SAME thread must not advance it again.
		for (let turn = 0; turn < 6; turn++) {
			expect(shouldAskConsent({ state: s, hasOpportunity: true, askedInThisThread: true })).toBe(false);
		}
		expect(s.opportunitiesSinceAsk).toBe(1);
	});
});

describe('applyConsentAnswer', () => {
	it('a yes grants without touching the decline history', () => {
		const p = applyConsentAnswer(state({ declines: 3 }), 'granted')!;
		expect(p.ledger_consent).toBe('granted');
		expect(p.ledger_declines).toBe(3);
	});

	it('a no increments the declines that drive the cadence', () => {
		const p = applyConsentAnswer(state({ declines: 2 }), 'declined')!;
		expect(p.ledger_consent).toBe('declined');
		expect(p.ledger_declines).toBe(3);
	});

	it('THE POINT: silence changes nothing — it is not agreement', () => {
		expect(applyConsentAnswer(state(), null)).toBeNull();
	});
});

describe('overlappingTopics', () => {
	it('finds what she is about to ask that he already answered', () => {
		const e = [entry('career', 'I design fintech apps'), entry('kids', 'no kids yet')];
		expect(overlappingTopics(['kids', 'travel'], e)).toEqual(['kids']);
	});

	it('is empty when her gaps are genuinely new ground', () => {
		expect(overlappingTopics(['travel'], [entry('career', 'x')])).toEqual([]);
	});

	it('ignores checklist items that never got a topic', () => {
		expect(overlappingTopics(['', 'career'], [entry('career', 'x')])).toEqual(['career']);
	});
});

describe('buildLedgerBlock', () => {
	const now = Date.now();

	it('carries the no-sources rule with the entries', () => {
		const b = buildLedgerBlock([entry('career', 'I design fintech apps')], 'Rishav', now);
		expect(b).toContain('NEVER say where it came from');
		expect(b).toContain('I design fintech apps');
	});

	it('flags an old answer as reconfirmable rather than fact', () => {
		const b = buildLedgerBlock([entry('career', 'I design fintech apps', 400)], 'Rishav', now);
		expect(b).toContain('a long time ago');
	});

	it('drops entries too old to be worth anything', () => {
		expect(buildLedgerBlock([entry('career', 'ancient', 900)], 'Rishav', now)).toBe('');
	});

	it('is empty with nothing stored, so the prompt keeps its old shape', () => {
		expect(buildLedgerBlock([], 'Rishav', now)).toBe('');
	});
});

describe('buildChecklistSuppressionBlock', () => {
	it('names the topics that must not become items', () => {
		const b = buildChecklistSuppressionBlock(['career', 'kids'], 'Rishav');
		expect(b).toContain('career, kids');
		expect(b).toContain('Do NOT create a checklist item');
	});

	it('is empty when he has answered nothing', () => {
		expect(buildChecklistSuppressionBlock([], 'Rishav')).toBe('');
	});
});
