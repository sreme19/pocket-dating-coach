/**
 * Proactive, preference-targeted proof invites for the AI Bestie (Design §11a/§11c).
 *
 * The topic→proof map only invites a proof when the MAN happens to mention the
 * topic. This surfaces the proofs SHE values most that he hasn't proven — so the
 * Bestie can proactively point him at the highest-leverage proof(s), with the
 * CONCRETE payoff (how far up her stack proving it moves him), and may name more
 * than one.
 *
 * Two hard rules baked into the copy:
 *   1. NO GUARANTEE — the Bestie may say a proof strengthens where he stands, but
 *      must NEVER commit that verifying will make her step in / reply / accept him.
 *   2. Warm, not a leaderboard — the payoff is framed as opportunity, never a cold
 *      ranking readout, and never her private weights.
 */
import type { Vec } from './vector-scoring';
import { proofPayoff } from './vector-scoring';
import { OPEN_DIMENSIONS, type DimensionId } from '$lib/verified-vibe/dimensions';
import {
	PROVABLE_DIMS,
	ASK_PHRASE,
	PROVEN_C,
	CLAIMING_V,
	MIN_WEIGHT,
	proofCategoryFor,
} from './dimension-proof-map';

export interface ProofInviteResult {
	/** Prompt block (leading newlines included), or '' when nothing to invite. */
	block: string;
	/** The single highest-leverage category to invite this turn (for proofRequest). */
	topCategory: string | null;
}

/** Round to a friendly integer rank movement description. */
function payoffPhrase(rankNow: number, rankIfVerified: number, pool: number): string {
	if (pool >= 2 && rankIfVerified < rankNow) {
		return `would move him from about #${rankNow} to #${rankIfVerified} of the ${pool} men she's matched with`;
	}
	return 'would noticeably strengthen where he lands with her';
}

/**
 * Build the PRIORITY PROOFS block. `allowed` is the invitable set from the proof
 * state machine (never re-invites verified/asked/refused, respects one-at-a-time).
 */
export function buildProofInviteContext(opts: {
	herWeights: Vec | null;
	hisAttrs: Vec | null;
	hisConf: Vec | null;
	rivalAppeals: number[];
	allowed: readonly string[];
	matchName: string;
	userName: string;
	max?: number;
}): ProofInviteResult {
	const { herWeights, hisAttrs, hisConf, rivalAppeals, allowed, matchName, userName } = opts;
	const max = opts.max ?? 2;
	if (!herWeights || !hisAttrs || !hisConf || allowed.length === 0) {
		return { block: '', topCategory: null };
	}

	// Provable dims she values that he hasn't proven, ranked by appeal ROOM she'd feel
	// (her weight × his claim × how unproven it is) — the biggest wins first.
	const ranked = PROVABLE_DIMS
		.map((d) => ({ d, w: herWeights[d] ?? 0, v: hisAttrs[d] ?? 0, c: hisConf[d] ?? 0 }))
		.filter((x) => x.w >= MIN_WEIGHT && x.c < PROVEN_C && x.v >= CLAIMING_V)
		.map((x) => ({ ...x, room: x.w * x.v * (1 - x.c) }))
		.sort((a, b) => b.room - a.room);

	const lines: string[] = [];
	let topCategory: string | null = null;
	for (const { d } of ranked) {
		const category = proofCategoryFor(d, allowed);
		if (!category) continue; // already verified/asked/refused, or ID-gated & unavailable
		const phrase = ASK_PHRASE[d] ?? (OPEN_DIMENSIONS.find((x) => x.id === d)?.label ?? d).toLowerCase();
		const { rankNow, rankIfVerified, pool } = proofPayoff(herWeights, hisAttrs, hisConf, rivalAppeals, d as DimensionId);
		if (!topCategory) topCategory = category;
		lines.push(`  - ${phrase} (${category}) — proving it ${payoffPhrase(rankNow, rankIfVerified, pool)}`);
		if (lines.length >= max) break;
	}
	if (!topCategory) return { block: '', topCategory: null };

	return {
		topCategory,
		block:
			`\n\nPRIORITY PROOFS (what ${userName} values most that ${matchName} hasn't proven yet — invite PROACTIVELY, highest first; you do NOT need him to bring up the topic):\n` +
			lines.join('\n') +
			`\n- Weave in the TOP one this turn as a warm, genuine nudge — his chance to make it real on his profile so ${userName} sees it verified (she never sees the file). Set "proofRequest" to that category. You MAY mention a second if it fits naturally; never more, never two invites in a row.` +
			`\n- You may convey the PAYOFF concretely (it strengthens where he stands with her / moves him up her list) so the ask feels worth it — but keep it warm and encouraging, never a cold ranking readout, and never reveal ${userName}'s private preferences.` +
			`\n- ABSOLUTE RULE: NEVER promise or imply that verifying will make ${userName} step in, reply, or choose him. No guarantees — a proof strengthens his case, it does not buy an outcome.`,
	};
}
