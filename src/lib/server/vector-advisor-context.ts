/**
 * Vector-model advisor context (Phase 4) — formats a user's Profile Strength band
 * + verification-upside into a prompt block the Wingman/Bestie can coach from,
 * grounded in the deterministic vector model rather than opaque LLM scores.
 *
 * GATED behind the ADVISOR_VECTORS flag (off by default) so it adds nothing to
 * live advisor behaviour until we deliberately turn it on. Returns '' when the
 * flag is off, the user has no vectors yet, or anything fails — always non-fatal.
 *
 * Shared by the live advisor endpoints AND the admin Test Suite (single source of
 * truth, so the two never drift).
 */

import { env } from '$env/dynamic/private';
import {
	profileStrength,
	profileStrengthBand,
	bandProgress,
	upsidePreview,
	upsideByDimension,
	type Vec,
} from './vector-scoring';

export function advisorVectorsEnabled(): boolean {
	return env.ADVISOR_VECTORS === 'true';
}

/**
 * Returns a formatted PROFILE STRENGTH block (leading newlines included) for the
 * given user, or '' if disabled / no vectors. Pure read + pure arithmetic, no LLM.
 */
export async function loadVectorAdvisorContext(supabase: any, userId: string): Promise<string> {
	if (!advisorVectorsEnabled()) return '';
	try {
		const { data } = await supabase
			.from('vv_user_vectors')
			.select('attributes, confidence')
			.eq('user_id', userId)
			.maybeSingle();
		if (!data?.attributes || Object.keys(data.attributes).length === 0) return '';

		const attrs = data.attributes as Vec;
		const conf = (data.confidence ?? {}) as Vec;
		const ps = profileStrength(attrs, conf);
		const prog = bandProgress(ps);
		const upside = upsidePreview(attrs, conf);
		const actions = upsideByDimension(attrs, conf).slice(0, 3);

		const nextLine = prog.nextBand
			? `He's ${prog.pointsToNextBand} from the “${prog.nextBand}” band.`
			: `He's in the top band — keep proofs fresh to hold it.`;
		const upsideLine = upside.deltaPS > 0
			? `If he VERIFIED his current claims, his standing would rise to about “${profileStrengthBand(upside.psVerified)}” — he's earned it on paper, he just hasn't proven it. Frame this as opportunity, never deficiency.`
			: `His claims are well-proven already.`;
		const actionLines = actions.length
			? actions.map((a) => `  - Verify ${a.label.toLowerCase()} → biggest single lift to his standing`).join('\n')
			: '  - (no high-leverage verification gaps right now)';

		return `

PROFILE STRENGTH (deterministic vector model — these numbers are EXACT, use them confidently):
- Current band: “${prog.band}.” ${nextLine}
- ${upsideLine}
- Highest-leverage verification moves, in order:
${actionLines}
Coach from this: the fastest standing gains come from VERIFYING claims (raising confidence), not just adding new ones. Surface the single highest-leverage move first, quantify the gain, and walk him through it. Persistent-but-positive — always opportunity, never deficiency.`;
	} catch {
		return '';
	}
}
