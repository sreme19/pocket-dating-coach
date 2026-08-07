/**
 * aibestie-opener.test.ts
 *
 * The opener is the first thing an ad visitor reads and the only place the AI
 * disclosure is guaranteed — it is a string in code precisely so no model can
 * drift off it. These tests hold that line, and the two claims it must never
 * make: that she will reply, and any clock.
 */

import { describe, it, expect } from 'vitest';
import { buildLpOpener } from '../aibestie-opener';

const staffed = { firstName: 'Jessica', terminus: 'human' as const };
const unstaffed = { firstName: 'Jessica', terminus: 'artifact' as const };

describe('buildLpOpener', () => {
	it('discloses the AI in the first sentence, either way', () => {
		for (const owner of [staffed, unstaffed]) {
			const text = buildLpOpener(owner);
			expect(text.split('.')[0]).toMatch(/AI bestie/i);
			expect(text).toContain("Jessica's AI bestie");
		}
	});

	it('ends on an open question, either way', () => {
		for (const owner of [staffed, unstaffed]) {
			expect(buildLpOpener(owner).trim().endsWith('?')).toBe(true);
		}
	});

	it('claims nobody is reading when the owner is unstaffed', () => {
		// The regression this file exists for. The opener originally hardcoded "and
		// she reads these herself" — false for a seed owner, and precisely the claim
		// terminusMode() exists to make impossible, smuggled back in as a template
		// literal. An earlier version of THIS TEST asserted the lie.
		expect(buildLpOpener(unstaffed).toLowerCase()).not.toContain('reads these');
	});

	it('claims she reads them only when a real human is behind the profile', () => {
		expect(buildLpOpener(staffed).toLowerCase()).toContain('reads these');
	});

	it('never promises she will reply, and never quotes a clock', () => {
		// Even staffed, the opener runs before anyone knows how the conversation
		// goes. Reading is a commitment she made; replying is not.
		for (const owner of [staffed, unstaffed]) {
			const text = buildLpOpener(owner).toLowerCase();
			for (const banned of ['will reply', 'gets back', 'step in', '48', 'hour', 'within']) {
				expect(text).not.toContain(banned);
			}
		}
	});

	it('survives a missing name without addressing her as undefined', () => {
		for (const name of ['', '   ']) {
			const text = buildLpOpener({ firstName: name, terminus: 'artifact' });
			expect(text).toContain('her AI bestie');
			expect(text).not.toMatch(/undefined|null|''/);
		}
	});

	it('never leaks her first-person profile prose', () => {
		// The first version spliced her `looking` text in verbatim. She writes it in
		// the first person, so her bestie ended up saying "a partner who respects MY
		// career" — and clipping the paragraph to fit also cut it mid-phrase. The
		// opener now takes only her name; the model handles her profile from turn one.
		const text = buildLpOpener(staffed);
		expect(text).not.toMatch(/\bmy\b/i);
		// Nothing clipped: it ends on real punctuation, not a dangling word.
		expect(text).not.toMatch(/\b(and|to|the|a|with|build)\s*[.?]$/i);
	});

	it('stays short enough to read on a phone before scrolling', () => {
		for (const owner of [staffed, unstaffed]) {
			expect(buildLpOpener(owner).length).toBeLessThan(280);
		}
	});
});
