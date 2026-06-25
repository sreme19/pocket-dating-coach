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
	appeal,
	profileStrength,
	profileStrengthBand,
	bandProgress,
	upsidePreview,
	upsideByDimension,
	pathGaps,
	type Vec,
} from './vector-scoring';

/**
 * Appeal-to-her threshold for the consent-unlock recommendation (§11d). The doc
 * specifies 80 on the old opaque-LLM scale; calibration showed the vector scale
 * runs ≈half, so we re-anchor to 55 here. Tunable as the pool grows.
 */
export const UNLOCK_APPEAL_THRESHOLD = 55;

export function advisorVectorsEnabled(): boolean {
	return env.ADVISOR_VECTORS === 'true';
}

/**
 * Returns a formatted PROFILE STRENGTH block (leading newlines included) for the
 * given user, or '' if disabled / no vectors. Pure read + pure arithmetic, no LLM.
 */
export async function loadVectorAdvisorContext(
	supabase: any,
	userId: string,
	opts: { subject?: 'man' | 'woman' } = {},
): Promise<string> {
	if (!advisorVectorsEnabled()) return '';
	const woman = opts.subject === 'woman';
	const Subj = woman ? 'She' : 'He';
	const poss = woman ? 'her' : 'his';
	const obj = woman ? 'her' : 'him';
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
			? `${Subj}'s ${prog.pointsToNextBand} from the “${prog.nextBand}” band.`
			: `${Subj}'s in the top band — keep proofs fresh to hold it.`;
		const upsideLine = upside.deltaPS > 0
			? `If ${poss === 'her' ? 'she' : 'he'} VERIFIED ${poss} current claims, ${poss} standing would rise to about “${profileStrengthBand(upside.psVerified)}” — ${poss === 'her' ? 'she' : 'he'}'s earned it on paper, just hasn't proven it. Frame this as opportunity, never deficiency.`
			: `${Subj}'s claims are well-proven already.`;
		const actionLines = actions.length
			? actions.map((a) => `  - Verify ${a.label.toLowerCase()} → biggest single lift to ${poss} standing`).join('\n')
			: '  - (no high-leverage verification gaps right now)';

		return `

PROFILE STRENGTH (deterministic vector model — these numbers are EXACT, use them confidently):
- Current band: “${prog.band}.” ${nextLine}
- ${upsideLine}
- Highest-leverage verification moves, in order:
${actionLines}
Coach from this: the fastest standing gains come from VERIFYING claims (raising confidence), not just adding new ones. Surface the single highest-leverage move first, quantify the gain, and walk ${obj} through it. Persistent-but-positive — always opportunity, never deficiency.`;
	} catch {
		return '';
	}
}

/**
 * Path plan (§11c) for the Wingman: per active match, the dimensions SHE weights
 * where HIS effective value has the most room, plus the lever (verify vs
 * strengthen). Translated by the advisor into approach advice — the block tells
 * the AI which areas to coach toward and the lever, but NEVER her actual weights.
 * Flag-gated; '' when off / no matches with vectors.
 */
export async function loadPathPlanContext(supabase: any, manId: string): Promise<string> {
	if (!advisorVectorsEnabled()) return '';
	try {
		const { data: me } = await supabase
			.from('vv_user_vectors').select('attributes, confidence').eq('user_id', manId).maybeSingle();
		if (!me?.attributes) return '';
		const myAttrs = me.attributes as Vec;
		const myConf = (me.confidence ?? {}) as Vec;

		const { data: matches } = await supabase
			.from('verified_vibe_matches')
			.select('user1_id, user2_id')
			.or(`user1_id.eq.${manId},user2_id.eq.${manId}`)
			.eq('status', 'mutual');
		const partnerIds: string[] = (matches ?? []).map((m: any) => (m.user1_id === manId ? m.user2_id : m.user1_id));
		if (!partnerIds.length) return '';

		const { data: women } = await supabase
			.from('verified_vibe_users').select('id, first_name, gender').in('id', partnerIds).eq('gender', 'woman');
		const nameMap = new Map<string, string>((women ?? []).map((u: any) => [u.id, u.first_name ?? 'She']));
		if (!nameMap.size) return '';

		const { data: vecs } = await supabase
			.from('vv_user_vectors').select('user_id, weights').in('user_id', [...nameMap.keys()]);

		const lines: string[] = [];
		for (const v of vecs ?? []) {
			const gaps = pathGaps((v.weights ?? {}) as Vec, myAttrs, myConf, 2);
			if (!gaps.length) continue;
			const name = nameMap.get(v.user_id) ?? 'She';
			const moves = gaps.map((g) => g.lever === 'verify'
				? `${g.label} (he's claimed this but not proven it — get him to VERIFY it)`
				: `${g.label} (genuinely thin — coach him to bring/build more here)`).join('; ');
			lines.push(`  - With **${name}**: focus on ${moves}`);
		}
		if (!lines.length) return '';

		return `

PATH PLAN (deterministic per-match levers — translate into APPROACH advice, NEVER state her weights or these labels as "what she wants"):
${lines.join('\n')}
For each: "verify" means the fastest win is proving an existing claim (raises confidence → appeal to her). "thin" means genuinely add/show more. Lead with the single highest-leverage move per match.`;
	} catch {
		return '';
	}
}

/**
 * Consent-unlock recommendations for a woman's Bestie (§11d): which of her matched
 * men have cleared the appeal-to-her bar (A = Σ wₕ·vₘ·cₘ ≥ threshold), so the
 * Bestie can RECOMMEND taking it offline — she always gives final consent, the
 * Bestie never opens a channel or shares contact unilaterally. Flag-gated; '' when
 * off / no qualifying men. Pure arithmetic, no LLM.
 */
export async function loadUnlockRecommendations(supabase: any, womanId: string): Promise<string> {
	if (!advisorVectorsEnabled()) return '';
	try {
		const { data: her } = await supabase
			.from('vv_user_vectors').select('weights').eq('user_id', womanId).maybeSingle();
		if (!her?.weights) return '';
		const herWeights = her.weights as Vec;

		const { data: matches } = await supabase
			.from('verified_vibe_matches')
			.select('user1_id, user2_id')
			.or(`user1_id.eq.${womanId},user2_id.eq.${womanId}`)
			.eq('status', 'mutual');
		const partnerIds: string[] = (matches ?? []).map((m: any) => (m.user1_id === womanId ? m.user2_id : m.user1_id));
		if (!partnerIds.length) return '';

		const { data: men } = await supabase
			.from('verified_vibe_users').select('id, first_name, gender').in('id', partnerIds).eq('gender', 'man');
		const menMap = new Map<string, string>((men ?? []).map((u: any) => [u.id, u.first_name ?? 'He']));
		if (!menMap.size) return '';

		const { data: vecs } = await supabase
			.from('vv_user_vectors').select('user_id, attributes, confidence').in('user_id', [...menMap.keys()]);

		const cleared: Array<{ name: string; appeal: number }> = [];
		for (const v of vecs ?? []) {
			const a = appeal(herWeights, (v.attributes ?? {}) as Vec, (v.confidence ?? {}) as Vec);
			if (a >= UNLOCK_APPEAL_THRESHOLD) cleared.push({ name: menMap.get(v.user_id) ?? 'He', appeal: a });
		}
		if (!cleared.length) return '';
		cleared.sort((a, b) => b.appeal - a.appeal);

		const names = cleared.map((c) => `**${c.name}**`).join(', ');
		return `

READY-TO-ESCALATE (consent-unlock — §11d): ${names} ${cleared.length === 1 ? 'has' : 'have'} cleared the bar — on the dimensions SHE values, ${cleared.length === 1 ? 'he brings' : 'they bring'} proven, high value to her specifically. You may RECOMMEND she take it offline (a call / her preferred channel) — but it is ALWAYS her decision: recommend, never open a channel or share contact yourself. Frame as "${cleared[0].name} has really shown up on what matters to you — want me to help you take this further?" Never reveal her preference weights or the score; speak in terms of fit and what he's proven.`;
	} catch {
		return '';
	}
}
