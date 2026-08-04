/**
 * Shared dimension ↔ proof mapping + gating thresholds. Single source of truth for
 * the hand-off gate (handoff-gate.ts) AND the proactive proof-invite context
 * (proof-invite-context.ts), so the two can never drift.
 */
import type { DimensionId } from '$lib/verified-vibe/dimensions';

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

/** Best in-chat proof categories per provable dimension, strongest first
 * (mirrors PROOF_CONFIDENCE in vector-builder + the proof-signals taxonomy). */
export const DIM_TO_PROOF: Partial<Record<DimensionId, string[]>> = {
	financial: ['wealth', 'assets', 'spending'],
	lifestyle: ['travel', 'lifestyle'],
	presentation: ['discipline'],
	social_legitimacy: ['linkedin', 'social_proof'],
	ambition: ['linkedin'],
};

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
