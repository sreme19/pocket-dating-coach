import { describe, it, expect } from 'vitest';
import { parsePhone, formatPhone, digitsOnly, DEFAULT_COUNTRY_CODE } from './phone';

/**
 * The beta form and /api/beta/submit both call parsePhone, so these cases are
 * the contract between them. The messy-input cases matter most: people paste
 * numbers with the country code already in them, or with a leading 0, and
 * rejecting those would read as "the form is broken".
 */

describe('parsePhone — India (the default)', () => {
	it('accepts a plain 10-digit mobile', () => {
		const r = parsePhone('+91', '9876543210');
		expect(r.ok).toBe(true);
		expect(r.e164).toBe('+919876543210');
		expect(r.national).toBe('9876543210');
	});

	it('accepts spaces and dashes', () => {
		expect(parsePhone('+91', '98765 43210').e164).toBe('+919876543210');
		expect(parsePhone('+91', '98765-43210').e164).toBe('+919876543210');
	});

	it('strips a duplicated country code typed into the number box', () => {
		expect(parsePhone('+91', '+91 98765 43210').e164).toBe('+919876543210');
		expect(parsePhone('+91', '00919876543210').e164).toBe('+919876543210');
	});

	it('strips a domestic trunk zero', () => {
		expect(parsePhone('+91', '09876543210').e164).toBe('+919876543210');
	});

	it('rejects the wrong length or a landline-style leading digit', () => {
		expect(parsePhone('+91', '98765').ok).toBe(false);
		expect(parsePhone('+91', '98765432101').ok).toBe(false);
		expect(parsePhone('+91', '1234567890').ok).toBe(false);
	});

	it('rejects an empty number with a number-specific message', () => {
		const r = parsePhone('+91', '   ');
		expect(r.ok).toBe(false);
		expect(r.error).toMatch(/WhatsApp number/i);
	});
});

describe('parsePhone — other countries', () => {
	it('accepts a plausible international number', () => {
		expect(parsePhone('+62', '81234567890').e164).toBe('+6281234567890');
		expect(parsePhone('+1', '4155552671').e164).toBe('+14155552671');
	});

	it('does not apply the Indian 10-digit rule elsewhere', () => {
		expect(parsePhone('+65', '81234567').ok).toBe(true);
	});

	it('rejects an unlisted country code', () => {
		const r = parsePhone('+999', '81234567');
		expect(r.ok).toBe(false);
		expect(r.error).toMatch(/country code/i);
	});

	it('rejects a number that would exceed the 15-digit E.164 limit', () => {
		expect(parsePhone('+880', '12345678901234').ok).toBe(false);
	});

	it('keeps a short national number that merely starts with its own dial code', () => {
		// +62 with "621234" — the 62 here is part of the number, not a duplicate,
		// because stripping it would leave too few digits to be a real number.
		expect(parsePhone('+62', '621234').national).toBe('621234');
	});
});

describe('helpers', () => {
	it('digitsOnly keeps only digits', () => {
		expect(digitsOnly('+91 (98765) 43-210')).toBe('919876543210');
	});

	it('formatPhone groups Indian numbers and passes others through', () => {
		expect(formatPhone(DEFAULT_COUNTRY_CODE, '9876543210')).toBe('+91 98765 43210');
		expect(formatPhone('+65', '81234567')).toBe('+65 81234567');
		expect(formatPhone(null, '9876543210')).toBe('');
		expect(formatPhone('+91', null)).toBe('');
	});
});
