/**
 * Hand-off proof gate (Design §3 "verification is the floor-raiser", §11d).
 *
 * The AI Bestie used to wrap up and hand a man off to the woman purely on
 * CONVERSATION — the checklist items are marked done on his verbal answers, with
 * no proof required. That let a man clear the bar to her attention on talk alone
 * while unproven on the very things she values most (income being the canonical
 * case: a woman whose top weight is `financial`, matched with a man who merely
 * *claims* a good income, c stuck at the 0.3 floor).
 *
 * This gate makes verification the floor for the hand-off: before Bestie brings
 * her in, if the woman VALUES a provable dimension where he has made a real CLAIM
 * but hasn't PROVEN it, hold the hand-off and invite that proof instead. Reads the
 * scoring vectors to decide (allowed — this gates a UX action ON scoring; it never
 * feeds UX state back INTO scoring). Degrades gracefully: no vectors → no block,
 * i.e. the prior conversation-only behaviour.
 */

import { env } from '$env/dynamic/private';
import { OPEN_DIMENSIONS, type DimensionId } from '$lib/verified-vibe/dimensions';
import type { Vec } from './vector-scoring';
import {
	PROVABLE_DIMS,
	DIM_TO_PROOF,
	ASK_PHRASE,
	PROVEN_C,
	CLAIMING_V,
	MIN_WEIGHT,
} from './dimension-proof-map';

export interface HandoffGate {
	ready: boolean;
	blockingDim: DimensionId | null;
	/** Friendly noun for the ask, e.g. "income". */
	blockingPhrase: string;
	/** Proof category to invite next (proof-signals taxonomy), or null. */
	requestCategory: string | null;
	reason: string;
}

const READY = (reason: string): HandoffGate => ({
	ready: true, blockingDim: null, blockingPhrase: '', requestCategory: null, reason,
});

/** Kill switch: HANDOFF_PROOF_GATE=false disables the gate without a redeploy. */
export function handoffGateEnabled(): boolean {
	return env.HANDOFF_PROOF_GATE !== 'false';
}

/**
 * Decide whether Bestie may hand the man off, or must draw proof of a valued
 * dimension first. Returns the single highest-value unproven dimension to gate on
 * and which proof to request for it.
 */
export function assessHandoffReadiness(args: {
	herWeights: Vec | null;
	hisAttrs: Vec | null;
	hisConf: Vec | null;
	verifiedCategories: string[];
	refusedCategories?: string[];
}): HandoffGate {
	if (!handoffGateEnabled()) return READY('gate-disabled');
	const { herWeights, hisAttrs, hisConf } = args;
	// No scoring data → don't block (graceful fallback to conversation-only).
	if (!herWeights || !hisAttrs || !hisConf) return READY('no-vectors');

	const verified = new Set(args.verifiedCategories ?? []);
	const refused = new Set(args.refusedCategories ?? []);

	// Her provable dimensions, most-valued first.
	const ranked = PROVABLE_DIMS
		.map((d) => ({ d, w: herWeights[d] ?? 0, v: hisAttrs[d] ?? 0, c: hisConf[d] ?? 0 }))
		.filter((x) => x.w >= MIN_WEIGHT)
		.sort((a, b) => b.w - a.w);

	for (const { d, w, v, c } of ranked) {
		if (c >= PROVEN_C) continue;   // already shown — fine
		if (v < CLAIMING_V) continue;  // not really claiming it — don't demand proof
		const target = (DIM_TO_PROOF[d] ?? []).find((cat) => !verified.has(cat) && !refused.has(cat));
		if (!target) continue;         // nothing left to ask (asked/refused/verified) — don't dead-end
		return {
			ready: false,
			blockingDim: d,
			blockingPhrase: ASK_PHRASE[d] ?? (OPEN_DIMENSIONS.find((x) => x.id === d)?.label ?? d).toLowerCase(),
			requestCategory: target,
			reason: `unproven high-value dim ${d} (w=${w.toFixed(2)}, v=${v}, c=${c})`,
		};
	}
	return READY('proof-coverage-ok');
}

/** Warm, woman-voiced line that pivots the wrap-up turn into a proof invite. */
export function handoffProofAskLine(phrase: string): string {
	return `Before I bring her in, it'd genuinely help if you could verify your ${phrase} — it's something she really cares about, and proving it here makes all the difference. Tap 📎 whenever you're ready.`;
}
