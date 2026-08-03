import { describe, it, expect } from 'vitest';
import {
	PROOF_CATEGORIES,
	PROOF_CATEGORY_IDS,
	proofCategory,
	isMoneyProofCategory,
	missingProofCategories,
	proofPortfolioProgress
} from '$lib/verified-vibe/proof-categories';
import { OPEN_DIMENSIONS, SENSITIVE_DIMENSIONS } from '$lib/verified-vibe/dimensions';

/**
 * The taxonomy used to live in four hand-maintained copies that disagreed about
 * which categories even exist. `trust-recompute` skips categories it does not
 * recognise, so `travel` and `wealth` earned nothing — six uploads across six real
 * members. These are the invariants that make that unrepresentable.
 */

const ALL_DIMENSION_IDS = new Set([...OPEN_DIMENSIONS, ...SENSITIVE_DIMENSIONS].map((d) => d.id));

describe('proof category taxonomy', () => {
	it('covers every category observed in production', () => {
		// Taken from completed `proof_*` verification steps in the live database.
		// travel and wealth are the two that previously scored zero.
		for (const id of [
			'lifestyle',
			'social_proof',
			'discipline',
			'travel',
			'linkedin',
			'instagram',
			'assets',
			'wealth',
			'intro'
		]) {
			expect(PROOF_CATEGORY_IDS, `production uses proof_${id}`).toContain(id);
		}
	});

	it('gives every category a non-zero trust weight', () => {
		// The original bug was not a wrong number — it was a MISSING entry that the
		// consumer silently skipped. A category with no credit is the same defect.
		for (const c of PROOF_CATEGORIES) {
			expect(c.trust.boost, `${c.id} must earn trust`).toBeGreaterThan(0);
			expect(c.trust.key, `${c.id} must name a subscore`).toBeTruthy();
		}
	});

	it('gives every category at least one real dimension', () => {
		for (const c of PROOF_CATEGORIES) {
			const dims = Object.keys(c.dims);
			expect(dims.length, `${c.id} must evidence something`).toBeGreaterThan(0);
			for (const d of dims) {
				expect(ALL_DIMENSION_IDS, `${c.id} → unknown dimension ${d}`).toContain(d);
			}
			for (const v of Object.values(c.dims)) {
				expect(v).toBeGreaterThan(0);
				expect(v).toBeLessThanOrEqual(1);
			}
		}
	});

	it('has unique ids', () => {
		expect(new Set(PROOF_CATEGORY_IDS).size).toBe(PROOF_CATEGORY_IDS.length);
	});

	it('resolves a known id and rejects an unknown one', () => {
		expect(proofCategory('travel')?.label).toBe('Travel');
		expect(proofCategory('not_a_category')).toBeUndefined();
	});
});

describe('isMoneyProofCategory', () => {
	it('flags the purely financial categories', () => {
		// These may still feed the aggregate, but must never be NAMED as a draw.
		for (const id of ['wealth', 'assets', 'spending']) {
			expect(isMoneyProofCategory(id), `${id} is money`).toBe(true);
		}
	});

	it('leaves categories that evidence anything non-financial alone', () => {
		// lifestyle, travel and career are coachable — over-broadening here would
		// gut legitimate advice.
		for (const id of ['lifestyle', 'travel', 'linkedin', 'discipline', 'social_proof', 'intro']) {
			expect(isMoneyProofCategory(id), `${id} is not money`).toBe(false);
		}
	});

	it('is false for an unknown id rather than throwing', () => {
		expect(isMoneyProofCategory('nonsense')).toBe(false);
	});
});

describe('missingProofCategories', () => {
	it('accepts bare ids and verification steps alike', () => {
		const fromSteps = missingProofCategories(['proof_travel', 'proof_lifestyle']);
		const fromIds = missingProofCategories(['travel', 'lifestyle']);
		expect(fromSteps.map((c) => c.id)).toEqual(fromIds.map((c) => c.id));
		expect(fromIds.map((c) => c.id)).not.toContain('travel');
	});

	it('returns everything when nothing is done, in priority order', () => {
		const missing = missingProofCategories([]);
		expect(missing).toHaveLength(PROOF_CATEGORIES.length);
		// linkedin leads: no ID gate, highest trust weight.
		expect(missing[0].id).toBe('linkedin');
		// The document-gated money categories trail.
		expect(missing[missing.length - 1].documentGated).toBe(true);
	});

	it('can exclude the document-gated categories for the picture-only chat surface', () => {
		const missing = missingProofCategories([], { excludeDocumentGated: true });
		expect(missing.every((c) => !c.documentGated)).toBe(true);
		expect(missing.map((c) => c.id)).not.toContain('wealth');
		expect(missing.map((c) => c.id)).toContain('travel');
	});

	it('can exclude money categories, for coaching that must not name them', () => {
		const missing = missingProofCategories([], { excludeMoney: true });
		expect(missing.map((c) => c.id)).not.toContain('wealth');
		expect(missing.map((c) => c.id)).not.toContain('assets');
		expect(missing.map((c) => c.id)).not.toContain('spending');
		expect(missing.map((c) => c.id)).toContain('lifestyle');
	});

	it('returns nothing once everything is proven', () => {
		expect(missingProofCategories(PROOF_CATEGORY_IDS)).toEqual([]);
	});
});

describe('proofPortfolioProgress', () => {
	it('counts done against the full taxonomy', () => {
		// The median production member has completed ZERO optional categories, which
		// is the number this card exists to move.
		const none = proofPortfolioProgress([]);
		expect(none.done).toBe(0);
		expect(none.total).toBe(PROOF_CATEGORIES.length);

		const some = proofPortfolioProgress(['proof_lifestyle', 'proof_discipline', 'proof_travel']);
		expect(some.done).toBe(3);
		expect(some.missing).toHaveLength(PROOF_CATEGORIES.length - 3);
	});

	it('ignores an unknown completed category rather than over-counting', () => {
		const p = proofPortfolioProgress(['proof_lifestyle', 'proof_not_a_real_thing']);
		expect(p.done).toBe(1);
	});
});
