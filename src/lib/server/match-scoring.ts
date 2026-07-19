/**
 * Match scoring (Phase 2) — the Matchmaker's two-sided compatibility + Standing.
 *
 * For each MUTUAL match it computes, from the privacy-safe pool data only:
 *   appeal_to_her — how well he fits HER stated preferences (drives his rank with her)
 *   appeal_to_him — how well she fits HIS stated preferences (drives her rank with him)
 *   his/her composite = 0.7*appeal + 0.3*normalized_trust  (she weighs fit AND credibility)
 *   his/her Standing  = rank of that composite among the OTHER side's mutual matches
 *   his/her checklist — approach advice to raise appeal (NEVER dumps her preferences)
 *   his/her simulation — what-if: each action → trust/percentile/Standing deltas
 *
 * Results are upserted into vv_match_scores so the Wingman/Bestie read them
 * synchronously (Phase 3) instead of scoring live. This is the heavy, LLM-driven
 * layer — it runs in the nightly batch / on triggers, never per chat turn.
 */

import { getSupabase } from './supabase';
import { getClaudeClient, CLAUDE_MODEL } from '$lib/claude';
import { computeSubscores, ARTIFACT_BOOST_MAP } from './trust-recompute';
import { normalizeScore } from './trust-normalize';
import { poolToWingmanRow, poolToBestieRow } from './matchmaker-service';
import { calculateCGTotal, type CGTrustSubscores } from '$lib/verified-vibe/server/trustScore';

// Load a user's unified vv_pool_profiles row mapped to the legacy scoring shape.
async function loadPoolRow(db: any, userId: string, assistant: 'wingman' | 'bestie') {
	const { data } = await db
		.from('vv_pool_profiles')
		.select('*')
		.eq('assistant_type', assistant)
		.eq('user_id', userId)
		.maybeSingle();
	if (!data) return null;
	return assistant === 'wingman' ? poolToWingmanRow(data) : poolToBestieRow(data);
}

const APPEAL_WEIGHT = 0.7;
const TRUST_WEIGHT = 0.3;
const MAX_RIVAL_SCORING = 10; // cap LLM calls when ranking rivals for Standing

const ARTIFACT_LABELS: Record<string, string> = {
	wealthy:       'wealth proof (spending / assets)',
	well_traveled: 'a travel photo',
	fitness:       'a fitness / recovery shot',
	general:       'a lifestyle moment',
};

function composite(appeal: number, normalizedTrust: number): number {
	return Math.round(APPEAL_WEIGHT * appeal + TRUST_WEIGHT * normalizedTrust);
}

// ── Directional compatibility (one Claude call returns BOTH directions) ────────

interface DirectionalResult {
	appealToHer: number;
	appealToHim: number;
	rationale: string;
	hisChecklist: string[];
	herChecklist: string[];
}

function buildDirectionalPrompt(male: any, female: any): string {
	const mp = male.match_profile ?? {};
	const ms = male.preference_signals ?? {};
	const fp = female.match_profile ?? {};
	const fm = female.preference_model ?? {};
	const arr = (x: unknown) => (Array.isArray(x) ? (x as string[]).join(', ') : '') || 'not specified';

	return `You score directional compatibility between a matched man and woman on a verified dating app, using ONLY the distilled signals below.

MAN — who he is:
- Intent: ${mp.intentStatement ?? 'not specified'}
- Personality: ${arr(mp.personalityDescriptors)}
- Lifestyle: ${arr(mp.lifestyleTags)}
- Verified proof signals: ${arr(mp.topProofSignals)}
MAN — what he's looking for:
- Looking for: ${ms.lookingFor ?? 'not specified'}
- Values: ${arr(ms.emotionalSignals)}

WOMAN — who she is:
- What she values: ${arr(fp.whatSheValues)}
- Compatibility signals: ${arr(fp.compatibilitySignals)}
- Verified proof signals: ${arr(fp.topProofSignals)}
WOMAN — what she's looking for:
- Relationship intent: ${fm.relationshipIntent ?? 'not specified'}
- Emotional signals she looks for: ${arr(fm.emotionalSignals)}
- Lifestyle signals she values: ${arr(fm.lifestyleSignals)}
- Maturity signals she values: ${arr(fm.maturitySignals)}

Score TWO directions, each 0–100:
1. appealToHer — how well HE satisfies what SHE is looking for.
2. appealToHim — how well SHE satisfies what HE is looking for.

Then write checklists of 3 concrete actions each person could take to raise their
appeal to the OTHER. These are APPROACH advice (what energy/effort to bring) — NEVER
quote or reveal the other person's private preferences verbatim.

Respond with ONLY valid JSON (no markdown, no code fences):
{"appealToHer":<int>,"appealToHim":<int>,"rationale":"<=2 sentences","hisChecklist":["...","...","..."],"herChecklist":["...","...","..."]}`;
}

export async function scoreDirectional(male: any, female: any): Promise<DirectionalResult> {
	const fallback: DirectionalResult = {
		appealToHer: 50, appealToHim: 50, rationale: 'Scoring unavailable — defaults applied.',
		hisChecklist: [], herChecklist: [],
	};
	try {
		const client = getClaudeClient();
		const res = await client.messages.create({
			model: CLAUDE_MODEL,
			max_tokens: 500,
			messages: [{ role: 'user', content: buildDirectionalPrompt(male, female) }],
		});
		const block = res.content[0];
		const raw = block.type === 'text' ? block.text.trim() : '{}';
		const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
		const p = JSON.parse(cleaned);
		return {
			appealToHer: Math.max(0, Math.min(100, Number(p.appealToHer) || 0)),
			appealToHim: Math.max(0, Math.min(100, Number(p.appealToHim) || 0)),
			rationale: String(p.rationale ?? ''),
			hisChecklist: Array.isArray(p.hisChecklist) ? p.hisChecklist.slice(0, 3) : [],
			herChecklist: Array.isArray(p.herChecklist) ? p.herChecklist.slice(0, 3) : [],
		};
	} catch (e) {
		console.warn('scoreDirectional failed (non-fatal):', e);
		return fallback;
	}
}

// ── What-if simulator (deterministic trust/percentile/Standing; appeal estimated) ──

export interface SimAction {
	action: string;
	label: string;
	trustBefore: number;   // displayed (normalized) trust now
	trustAfter: number;    // predicted displayed trust after the action
	standingBefore: number | null;
	standingAfter: number | null;
	standingPool: number | null;
	deterministic: boolean; // true for trust/percentile/Standing; appeal effects are estimates
	note?: string;
}

/**
 * Build the action→effect list for one side. Trust/percentile/Standing deltas are
 * exact (proof points are constants, percentile is computable, rivals' composites
 * are known). Appeal is held constant — uploads only *might* raise it — so each
 * action notes that possibility rather than promising an appeal jump.
 */
function buildSimulation(
	subscores: CGTrustSubscores,
	identityVerified: boolean,
	currentNormalized: number,
	cohortOthers: number[],          // cohort raw scores EXCLUDING this user
	appeal: number,                  // appeal toward the partner (held constant)
	rivalComposites: number[],       // the OTHER mutual matches' composites (excl. this user)
): SimAction[] {
	const actions: SimAction[] = [];

	const rankOf = (c: number) =>
		[...rivalComposites, c].sort((a, b) => b - a).indexOf(c) + 1;
	const pool = rivalComposites.length + 1;
	const standingBefore = rankOf(composite(appeal, currentNormalized));

	const evaluate = (newSubs: CGTrustSubscores, idv: boolean): { norm: number; rank: number } => {
		const newRaw = calculateCGTotal(newSubs);
		const norm = normalizeScore(newRaw, idv, [...cohortOthers, newRaw]);
		return { norm, rank: rankOf(composite(appeal, norm)) };
	};

	// Identity verification — the heaviest lever for unverified men.
	if (!identityVerified) {
		const s = { ...subscores, identity: 100 };
		const { norm, rank } = evaluate(s, true);
		actions.push({
			action: 'verify_identity',
			label: 'Verify your ID + selfie',
			trustBefore: currentNormalized, trustAfter: norm,
			standingBefore, standingAfter: rank, standingPool: pool,
			deterministic: true,
			note: 'Biggest lever — until you do this your score is heavily penalised.',
		});
	}

	// Each 📎 artifact category not yet effectively present.
	for (const [tag, b] of Object.entries(ARTIFACT_BOOST_MAP)) {
		if (subscores[b.key] >= 100) continue; // dimension already maxed — no trust gain
		const s = { ...subscores, [b.key]: Math.min(100, subscores[b.key] + b.boost) };
		const { norm, rank } = evaluate(s, identityVerified);
		if (norm === currentNormalized && rank === standingBefore) continue; // no effect, skip
		actions.push({
			action: `upload_${tag}`,
			label: `Upload ${ARTIFACT_LABELS[tag] ?? tag}`,
			trustBefore: currentNormalized, trustAfter: norm,
			standingBefore, standingAfter: rank, standingPool: pool,
			deterministic: true,
			note: 'May also raise your appeal with her if she values this.',
		});
	}

	// Sort by trust gain (biggest needle-mover first).
	return actions.sort((a, b) => (b.trustAfter - b.trustBefore) - (a.trustAfter - a.trustBefore));
}

// ── Orchestrator ───────────────────────────────────────────────────────────────

const ACTIVE_WINDOW_DAYS = 7;
function activeCutoff(): string {
	return new Date(Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** Mutual-match partner ids for a user. */
async function mutualPartners(db: any, userId: string): Promise<string[]> {
	const { data } = await db
		.from('verified_vibe_matches')
		.select('user1_id, user2_id')
		.or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
		.eq('status', 'mutual');
	return (data ?? []).map((m: any) => (m.user1_id === userId ? m.user2_id : m.user1_id));
}

/**
 * Compute + persist vv_match_scores for every mutual match of `userId` (either
 * gender). Returns the rows written. Heavy (LLM) — call from batch/triggers.
 */
export async function generateMatchScores(userId: string): Promise<any[]> {
	const db = getSupabase() as any;
	const written: any[] = [];

	const { data: me } = await db
		.from('verified_vibe_users')
		.select('id, gender, normalized_trust, raw_trust, identity_verified')
		.eq('id', userId)
		.maybeSingle();
	if (!me) return written;

	const partnerIds = await mutualPartners(db, userId);
	if (!partnerIds.length) return written;

	// Male-gender cohort raws (for the man's simulation percentile), minus the focal man.
	const cohortRawsByGender: Record<string, number[]> = {};
	async function cohortOthers(gender: string, excludeId: string): Promise<number[]> {
		if (!cohortRawsByGender[gender]) {
			const { data } = await db
				.from('verified_vibe_users')
				.select('id, raw_trust')
				.eq('is_seed', false).eq('gender', gender)
				.is('deleted_at', null)
				.gte('last_active_at', activeCutoff());
			cohortRawsByGender[gender] = (data ?? []).map((r: any) => ({ id: r.id, raw: r.raw_trust ?? 0 }));
		}
		return (cohortRawsByGender[gender] as any[])
			.filter((r) => r.id !== excludeId).map((r) => r.raw);
	}

	for (const partnerId of partnerIds) {
		const { data: partner } = await db
			.from('verified_vibe_users')
			.select('id, gender, normalized_trust')
			.eq('id', partnerId).maybeSingle();
		if (!partner) continue;

		// Resolve male/female.
		const maleId = me.gender === 'man' ? me.id : partner.id;
		const femaleId = me.gender === 'woman' ? me.id : partner.id;
		const maleNorm = (me.gender === 'man' ? me.normalized_trust : partner.normalized_trust) ?? 0;
		const femaleNorm = (me.gender === 'woman' ? me.normalized_trust : partner.normalized_trust) ?? 0;

		const [malePool, femalePool] = await Promise.all([
			loadPoolRow(db, maleId, 'wingman'),
			loadPoolRow(db, femaleId, 'bestie'),
		]);
		if (!malePool || !femalePool) continue; // can't score without distilled profiles

		const dir = await scoreDirectional(malePool, femalePool);
		const hisComposite = composite(dir.appealToHer, maleNorm);
		const herComposite = composite(dir.appealToHim, femaleNorm);

		// Standing rival composites (other mutual matches of each side).
		const hisRivalComposites = await rivalComposites(db, femaleId, maleId, 'man');
		const herRivalComposites = await rivalComposites(db, maleId, femaleId, 'woman');
		const hisRank = rank(hisComposite, hisRivalComposites);
		const herRank = rank(herComposite, herRivalComposites);

		// Simulations.
		const [maleSubs, femaleSubs] = await Promise.all([
			computeSubscores(maleId), computeSubscores(femaleId),
		]);
		const hisSim = buildSimulation(
			maleSubs.subscores, maleSubs.identityVerified, maleNorm,
			await cohortOthers('man', maleId), dir.appealToHer, hisRivalComposites,
		);
		const herSim = buildSimulation(
			femaleSubs.subscores, femaleSubs.identityVerified, femaleNorm,
			await cohortOthers('woman', femaleId), dir.appealToHim, herRivalComposites,
		);

		const { data: matchRow } = await db
			.from('verified_vibe_matches')
			.select('id')
			.or(`and(user1_id.eq.${maleId},user2_id.eq.${femaleId}),and(user1_id.eq.${femaleId},user2_id.eq.${maleId})`)
			.eq('status', 'mutual').maybeSingle();

		const row = {
			male_user_id: maleId,
			female_user_id: femaleId,
			match_id: matchRow?.id ?? null,
			appeal_to_her: dir.appealToHer,
			appeal_to_him: dir.appealToHim,
			his_composite: hisComposite,
			her_composite: herComposite,
			his_standing_rank: hisRank,
			his_standing_pool: hisRivalComposites.length + 1,
			her_standing_rank: herRank,
			her_standing_pool: herRivalComposites.length + 1,
			his_checklist: dir.hisChecklist,
			her_checklist: dir.herChecklist,
			his_simulation: hisSim,
			her_simulation: herSim,
			rationale: dir.rationale,
			computed_at: new Date().toISOString(),
		};
		await db.from('vv_match_scores').upsert(row, { onConflict: 'male_user_id,female_user_id' });
		written.push(row);
	}

	return written;
}

/**
 * Full pass: score every mutual-matched pair once. Iterates the distinct MEN in
 * mutual matches (generateMatchScores computes both directions per pair, so the
 * men cover all hetero pairs without double-work). Returns the pair count.
 */
export async function runAllMatchScores(): Promise<{ pairs: number; men: number }> {
	const db = getSupabase() as any;
	const { data: matches } = await db
		.from('verified_vibe_matches')
		.select('user1_id, user2_id')
		.eq('status', 'mutual');
	const ids = new Set<string>();
	for (const m of matches ?? []) { ids.add(m.user1_id); ids.add(m.user2_id); }
	if (!ids.size) return { pairs: 0, men: 0 };

	const { data: users } = await db
		.from('verified_vibe_users')
		.select('id, gender')
		.in('id', [...ids])
		.is('deleted_at', null);
	const men = (users ?? []).filter((u: any) => u.gender === 'man').map((u: any) => u.id);

	let pairs = 0;
	for (const mId of men) {
		const written = await generateMatchScores(mId);
		pairs += written.length;
	}
	return { pairs, men: men.length };
}

function rank(score: number, rivals: number[]): number {
	return [...rivals, score].sort((a, b) => b - a).indexOf(score) + 1;
}

/**
 * Composites of the OTHER same-gender users mutually matched with `targetId`,
 * excluding `selfId`. Reads cached vv_match_scores where possible; scores
 * uncached pairs (capped) so Standing is real, not approximated.
 */
async function rivalComposites(
	db: any, targetId: string, selfId: string, rivalGender: 'man' | 'woman'
): Promise<number[]> {
	const partners = await mutualPartners(db, targetId); // same-gender rivals of selfId
	const rivals = partners.filter((p) => p !== selfId);
	if (!rivals.length) return [];

	const composites: number[] = [];
	let scored = 0;
	for (const rivalId of rivals) {
		const maleId = rivalGender === 'man' ? rivalId : targetId;
		const femaleId = rivalGender === 'woman' ? rivalId : targetId;
		const { data: cached } = await db
			.from('vv_match_scores')
			.select('his_composite, her_composite')
			.eq('male_user_id', maleId).eq('female_user_id', femaleId).maybeSingle();
		const cachedComposite = rivalGender === 'man' ? cached?.his_composite : cached?.her_composite;
		if (typeof cachedComposite === 'number') { composites.push(cachedComposite); continue; }

		if (scored >= MAX_RIVAL_SCORING) {
			// Cap hit — approximate with normalized trust only (logged as partial).
			const { data: ru } = await db.from('verified_vibe_users').select('normalized_trust').eq('id', rivalId).maybeSingle();
			composites.push(composite(50, ru?.normalized_trust ?? 0));
			continue;
		}
		// Score the rival pair fresh.
		const [mp, fp, { data: mu }, { data: fu }] = await Promise.all([
			loadPoolRow(db, maleId, 'wingman'),
			loadPoolRow(db, femaleId, 'bestie'),
			db.from('verified_vibe_users').select('normalized_trust').eq('id', maleId).maybeSingle(),
			db.from('verified_vibe_users').select('normalized_trust').eq('id', femaleId).maybeSingle(),
		]);
		if (!mp || !fp) continue;
		const d = await scoreDirectional(mp, fp);
		scored++;
		composites.push(rivalGender === 'man'
			? composite(d.appealToHer, mu?.normalized_trust ?? 0)
			: composite(d.appealToHim, fu?.normalized_trust ?? 0));
	}
	return composites;
}
