import { describe, expect, it } from 'vitest';
import { normaliseEmail, normalisePhone } from '../marketing-leads';

/**
 * These two functions decide what lands in a column with a UNIQUE index on it, so
 * they are the difference between one lead and the same woman written twice and
 * called twice. Everything here is about that: the same number typed five
 * plausible ways has to collapse to one string.
 */

describe('normalisePhone', () => {
	it('collapses every way an Indian mobile gets typed into one E.164 string', () => {
		// If any of these ever disagree, the unique index stops deduplicating and
		// the dialer calls one person once per spelling.
		const same = [
			'9876543210',
			'09876543210',
			'919876543210',
			'+919876543210',
			'+91 98765 43210',
			'+91-98765-43210',
			'98765 43210',
			'  9876543210  ',
			'(98765) 43210'
		];
		for (const raw of same) {
			expect(normalisePhone(raw), raw).toBe('+919876543210');
		}
	});

	it('accepts each valid Indian mobile prefix', () => {
		for (const first of ['6', '7', '8', '9']) {
			expect(normalisePhone(`${first}876543210`)).toBe(`+91${first}876543210`);
		}
	});

	it('rejects a leading digit below 6', () => {
		// Landlines and typos. The dialer cannot use either, so they must not be
		// stored as if it could.
		for (const first of ['0', '1', '2', '3', '4', '5']) {
			expect(normalisePhone(`${first}876543210`), first).toBeNull();
		}
	});

	it('rejects wrong lengths', () => {
		expect(normalisePhone('987654321')).toBeNull(); // nine
		expect(normalisePhone('98765432101')).toBeNull(); // eleven
		expect(normalisePhone('')).toBeNull();
		expect(normalisePhone('   ')).toBeNull();
	});

	it('rejects a non-Indian country code rather than silently relabelling it +91', () => {
		// The stripping rules only fire on a 12-digit +91 or an 11-digit leading 0.
		// A +44 number matches neither, so it must fall through to null — quietly
		// storing it as +91 would write a number that dials someone else entirely.
		expect(normalisePhone('+447700900123')).toBeNull();
		expect(normalisePhone('+12025550123')).toBeNull();
	});

	it('rejects text', () => {
		expect(normalisePhone('call me')).toBeNull();
		expect(normalisePhone('nine eight seven')).toBeNull();
	});
});

describe('normaliseEmail', () => {
	it('lowercases and trims, so case is never a second row', () => {
		expect(normaliseEmail('  Priya@Example.COM ')).toBe('priya@example.com');
	});

	it('accepts ordinary and awkward-but-valid addresses', () => {
		for (const ok of [
			'a@b.co',
			'priya.sharma@gmail.com',
			'priya+ads@example.co.in',
			"o'brien@example.com",
			'p_s-1@sub.domain.example.org'
		]) {
			expect(normaliseEmail(ok), ok).toBe(ok.toLowerCase());
		}
	});

	it('rejects addresses with no domain dot', () => {
		expect(normaliseEmail('priya@localhost')).toBeNull();
		expect(normaliseEmail('priya@com')).toBeNull();
	});

	it('rejects the usual malformed shapes', () => {
		for (const bad of ['', '   ', 'priya', 'priya@', '@example.com', 'a b@example.com', 'a@b@c.com']) {
			expect(normaliseEmail(bad), JSON.stringify(bad)).toBeNull();
		}
	});

	it('rejects an address longer than the column allows', () => {
		expect(normaliseEmail(`${'a'.repeat(250)}@example.com`)).toBeNull();
	});
});
