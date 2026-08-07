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

describe('buildLpOpener', () => {
	it('discloses the AI in the first sentence', () => {
		const text = buildLpOpener({ firstName: 'Jessica' });
		expect(text.split('.')[0]).toMatch(/AI bestie/i);
		expect(text).toContain("Jessica's AI bestie");
	});

	it('ends on an open question', () => {
		expect(buildLpOpener({ firstName: 'Jessica' }).trim().endsWith('?')).toBe(true);
	});

	it('never promises she will reply, and never quotes a clock', () => {
		// Whether a human is behind the profile is terminusMode()'s decision, made
		// from configuration and much later. The opener runs before anyone knows how
		// the conversation goes, so it may only claim she READS these.
		const text = buildLpOpener({ firstName: 'Jessica' }).toLowerCase();
		expect(text).toMatch(/reads these/);
		for (const banned of ['will reply', 'gets back', 'step in', '48', 'hour', 'within']) {
			expect(text).not.toContain(banned);
		}
	});

	it('survives a missing name without addressing her as undefined', () => {
		for (const name of ['', '   ']) {
			const text = buildLpOpener({ firstName: name });
			expect(text).toContain("her AI bestie");
			expect(text).not.toMatch(/undefined|null|''/);
		}
	});

	it('never leaks her first-person profile prose', () => {
		// The first version spliced her `looking` text in verbatim. She writes it in
		// the first person, so her bestie ended up saying "a partner who respects MY
		// career" — and clipping the paragraph to fit also cut it mid-phrase. The
		// opener now takes only her name; the model handles her profile from turn one.
		const text = buildLpOpener({ firstName: 'Jessica' });
		expect(text).not.toMatch(/\bmy\b/i);
		// Nothing clipped: it ends on real punctuation, not a dangling word.
		expect(text).not.toMatch(/\b(and|to|the|a|with|build)\s*[.?]$/i);
	});

	it('stays short enough to read on a phone before scrolling', () => {
		expect(buildLpOpener({ firstName: 'Jessica' }).length).toBeLessThan(280);
	});
});
