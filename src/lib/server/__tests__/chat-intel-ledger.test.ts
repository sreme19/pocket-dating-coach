import { describe, it, expect } from 'vitest';
import { selectLedgerRows } from '../chat-intel-capture';

// The ledger exists so a later Bestie can quote a man's own words back to him
// instead of re-asking. That only works if what we stored is genuinely his — so
// the gate is "did he actually type this", not "does it sound plausible".

const MSG =
	"I've been a product designer at a fintech for about six years now, and honestly " +
	"I'm looking for something serious rather than dating around.";

describe('selectLedgerRows — the verbatim gate', () => {
	it('keeps a literal quote from the message', () => {
		const rows = selectLedgerRows(MSG, [
			{ topic: 'career', answer: "I've been a product designer at a fintech for about six years" },
		]);
		expect(rows).toHaveLength(1);
		expect(rows[0].topic).toBe('career');
	});

	it('THE POINT: drops a paraphrase, however accurate', () => {
		// True to the message, but not his words. A Bestie quoting this back would be
		// putting language in his mouth, which is worse than asking him again.
		const rows = selectLedgerRows(MSG, [
			{ topic: 'career', answer: 'Works as a product designer at a fintech company' },
		]);
		expect(rows).toEqual([]);
	});

	it('drops an outright fabrication', () => {
		const rows = selectLedgerRows(MSG, [{ topic: 'kids', answer: 'He wants three children' }]);
		expect(rows).toEqual([]);
	});

	it('tolerates whitespace and case drift in the quote', () => {
		// Models reflow quotes; that is not fabrication, so it should survive.
		const rows = selectLedgerRows(MSG, [
			{ topic: 'intentions', answer: "I'M LOOKING FOR   something serious" },
		]);
		expect(rows).toHaveLength(1);
	});

	it('keeps several topics from one message', () => {
		const rows = selectLedgerRows(MSG, [
			{ topic: 'career', answer: "I've been a product designer at a fintech" },
			{ topic: 'intentions', answer: "I'm looking for something serious" },
		]);
		expect(rows.map((r) => r.topic)).toEqual(['career', 'intentions']);
	});

	it('caps how much one message can contribute', () => {
		const rows = selectLedgerRows(MSG, [
			{ topic: 'a1', answer: "I've been a product designer" },
			{ topic: 'b2', answer: 'at a fintech for about six years' },
			{ topic: 'c3', answer: "I'm looking for something serious" },
			{ topic: 'd4', answer: 'rather than dating around' },
		]);
		expect(rows).toHaveLength(3);
	});

	it('dedupes the same answer repeated on one topic', () => {
		const q = "I'm looking for something serious";
		const rows = selectLedgerRows(MSG, [
			{ topic: 'intentions', answer: q },
			{ topic: 'intentions', answer: q.toUpperCase() },
		]);
		expect(rows).toHaveLength(1);
	});

	it('skips fragments too short to mean anything', () => {
		const rows = selectLedgerRows(MSG, [{ topic: 'career', answer: 'six' }]);
		expect(rows).toEqual([]);
	});

	it('skips entries with no topic', () => {
		const rows = selectLedgerRows(MSG, [
			{ topic: '', answer: "I'm looking for something serious" },
		]);
		expect(rows).toEqual([]);
	});

	it('normalises the topic key so casing never forks a topic', () => {
		const rows = selectLedgerRows(MSG, [
			{ topic: 'Career', answer: "I've been a product designer at a fintech" },
		]);
		expect(rows[0].topic).toBe('career');
	});
});
