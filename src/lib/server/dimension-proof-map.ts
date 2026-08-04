/**
 * Shared dimension ↔ proof mapping + gating thresholds. Single source of truth for
 * the hand-off gate (handoff-gate.ts) AND the proactive proof-invite context
 * (proof-invite-context.ts), so the two can never drift.
 */
import type { DimensionId } from '$lib/verified-vibe/dimensions';
import { PROOF_CATEGORIES } from '$lib/verified-vibe/proof-categories';

/** Dimensions backable by a proof UPLOAD. Soft dims (humor, warmth, intellect,
 * family) can't be "proven" by a file, so we never invite/gate on them.
 *
 * `financial` is deliberately NOT here. Money is a fraud check, never an attraction
 * signal: neither companion may describe anyone in terms of what they earn or can
 * pay for, so Bestie must not gate a hand-off on it or invite it in chat either.
 * Asking did not work in any case — across production, income/wealth/assets/spending
 * asks ran 0 fulfilled to 4 refused, and one man's flat "stop asking me for my income
 * proof, I am not applying for a loan" was logged as a red flag AGAINST him.
 *
 * Financial documents still contribute to his score through the normal verification
 * pipeline, and Wingman may still encourage him to verify them — just never on the
 * grounds that it makes him more appealing. Only these two Bestie-side surfaces
 * (handoff-gate, proof-invite-context) read this list, so dropping it here does not
 * touch that. The `financial` entries below stay for the scoring map. */
export const PROVABLE_DIMS: DimensionId[] = ['lifestyle', 'presentation', 'social_legitimacy', 'ambition'];

/**
 * A proof this weak is not worth offering. Confidence ACCUMULATES rather than
 * replacing, so small contributions do add up — but a 0.1 route earns him almost
 * nothing and cluttering his options with it makes the useful ones harder to see.
 */
const MIN_ROUTE_CONFIDENCE = 0.2;

/**
 * Proof categories per provable dimension, strongest first — DERIVED by inverting the
 * canonical taxonomy rather than hand-written.
 *
 * It used to be a hand-maintained literal and it had gone stale in exactly the way this
 * codebase has been bitten by before: five picture categories that exist and carry real
 * dimension confidence — hosting, intro, instagram, habit_tracker, twitter — were absent
 * from it, so nothing ever offered them and a man could never use them to close a gap.
 * proof-categories.ts calls itself the single source of truth and vector-builder's
 * PROOF_CONFIDENCE already derives from it; this was the last copy still drifting.
 *
 * Inverting also fixes route collapse. `social_legitimacy` had two entries and shared
 * one of them with `ambition`, so a single refusal of `linkedin` killed both dimensions
 * and a third of matches ended up with no alternative route at all. It now has four.
 */
export const DIM_TO_PROOF: Partial<Record<DimensionId, string[]>> = (() => {
	const byDim: Record<string, string[]> = {};
	// PROOF_CATEGORIES is already in the order the advisor should prefer — its own
	// header says so: "lowest friction and highest leverage first". So walk it in
	// order and keep it. Sorting by confidence instead looked reasonable and was
	// wrong: it promoted `lifestyle` (0.6) over `travel` (0.55) and quietly reversed
	// a deliberate product choice about which is the easier thing to ask a man for.
	// A test caught it.
	for (const cat of PROOF_CATEGORIES) {
		for (const [dim, c] of Object.entries(cat.dims)) {
			if ((c ?? 0) < MIN_ROUTE_CONFIDENCE) continue;
			(byDim[dim] ||= []).push(cat.id);
		}
	}
	return byDim;
})();

/**
 * How to ask for a specific CATEGORY, in a few words.
 *
 * This is what a man is actually offered now, instead of the per-dimension phrase
 * below. Two reasons. It gives him thirteen distinct things he might be asked rather
 * than four, so "your next step" stops being one of four sentences he hears in every
 * conversation. And because siblings no longer share wording, falling through from a
 * declined category to another in the same dimension no longer re-sends a word-for-word
 * identical ask — which is what forced the old all-or-nothing refusal rule.
 *
 * Derived from each category's own askPhrase with the parenthetical stripped: the long
 * form ("fitness / discipline (you at the gym, training, sport)") explains the upload,
 * the short form is what fits in a sentence or a chip.
 */
export const CATEGORY_ASK_PHRASE: Record<string, string> = Object.fromEntries(
	PROOF_CATEGORIES.map((c) => [
		c.id,
		c.askPhrase
			.replace(/\s*\(.*$/, '') // drop the explanatory parenthetical
			// Both surfaces that use this say "your <phrase>", so the phrase has to be a
			// bare noun. Left as-is, the taxonomy's own wording produces "your a habit or
			// training streak" and "your your Instagram".
			.replace(/^(a|an|your)\s+/i, '')
			.replace(/\s+of yourself$/i, '')
			.trim(),
	])
);

/** Friendly noun for a woman-voiced proof ask (never the raw dimension label). */
export const ASK_PHRASE: Partial<Record<DimensionId, string>> = {
	financial: 'income',
	lifestyle: 'lifestyle',
	presentation: 'fitness',
	social_legitimacy: 'work / professional side',
	ambition: 'career',
};

export const PROVEN_C = 0.55;   // c at/above which a claim counts as "shown enough"
export const CLAIMING_V = 45;   // he must be making a real claim to be worth proving
export const MIN_WEIGHT = 0.10; // she must genuinely care about the dimension

/** The first proof category for a dimension that is still invitable (not
 * verified / asked / refused, and in the allowed set). Null when none remain. */
export function proofCategoryFor(
	dim: DimensionId,
	allowed: readonly string[],
): string | null {
	const cats = DIM_TO_PROOF[dim] ?? [];
	return cats.find((c) => allowed.includes(c)) ?? null;
}
