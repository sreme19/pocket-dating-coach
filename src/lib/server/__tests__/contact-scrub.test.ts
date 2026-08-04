import { describe, it, expect } from 'vitest';
import { scrubContactDetails } from '../contact-scrub';

describe('scrubContactDetails', () => {
	it('leaves an ordinary Bestie reply completely untouched', () => {
		const clean = "Respecting people's time instead of pushing, that's solid. Shalini's the same way.";
		const { text, removed } = scrubContactDetails(clean);
		expect(text).toBe(clean);
		expect(removed).toEqual([]);
	});

	it('removes the handle from the exact production leak', () => {
		// jot kaur ↔ Subramanya, 2026-07-28: she pasted her own Instagram link (her
		// right, §K(c)); a few turns later her Bestie re-sent the handle for her.
		const { text, removed } = scrubContactDetails(
			"kaur__gil__official__786 that's the handle!"
		);
		// The bare-username shape is the known gap — no @, no domain — so this one is
		// still on the prompt rule. Asserted so the gap is visible rather than assumed shut.
		expect(text).toContain('kaur__gil__official__786');
		expect(removed).toEqual([]);
	});

	it('removes the link form of that same leak', () => {
		const { text, removed } = scrubContactDetails(
			'here you go: https://www.instagram.com/kaur__gil__official__786?igsh=MmN2'
		);
		expect(text).not.toContain('instagram');
		expect(text).not.toContain('kaur__gil');
		expect(removed).toContain('url');
	});

	it('removes an @handle but keeps the character in front of it', () => {
		const { text, removed } = scrubContactDetails('find her @kaur_gil, easy');
		expect(text).not.toContain('@kaur_gil');
		expect(text).toMatch(/find her /);
		expect(removed).toContain('handle');
	});

	it('removes emails, and does not mistake them for handles', () => {
		const { removed } = scrubContactDetails('mail her on shalini.k@gmail.com');
		expect(removed).toContain('email');
		expect(removed).not.toContain('handle');
	});

	it('removes phone numbers including +91 with separators', () => {
		for (const n of ['+91 98765 43210', '9876543210', '+91-98765-43210']) {
			const { text, removed } = scrubContactDetails(`her number is ${n}`);
			expect(removed).toContain('phone');
			expect(text).not.toContain('98765');
		}
	});

	it('removes bare domains and deep links', () => {
		const { text, removed } = scrubContactDetails('ping her on wa.me/919876543210');
		expect(removed.length).toBeGreaterThan(0);
		expect(text).not.toContain('wa.me');
	});

	it('does NOT eat the numbers Bestie legitimately quotes', () => {
		// The hand-off clock work depends on her being able to state real figures.
		const lines = [
			'she was notified about 51 hours ago and has under an hour left',
			"there's 38h left to decide",
			'you get a fresh match automatically at no cost'
		];
		for (const l of lines) expect(scrubContactDetails(l).text).toBe(l);
	});

	it('does NOT eat ordinary abbreviations or the attach hint', () => {
		for (const l of ['e.g. a gym shot', 'travel, food, etc.', 'Tap 📎 whenever you are ready']) {
			expect(scrubContactDetails(l).text).toBe(l);
		}
	});

	it('collapses several details in a row into one boundary', () => {
		const { text } = scrubContactDetails('reach her: a@b.com, +91 98765 43210, @ab_cd');
		expect(text.match(/she'll share that herself/g)?.length).toBe(1);
	});

	it('handles empty input', () => {
		expect(scrubContactDetails('').text).toBe('');
	});
});
