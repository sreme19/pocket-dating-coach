/**
 * Phase 1 SHADOW orchestrator — runs the pure vector scoring engine over real
 * data and persists results into shadow columns ALONGSIDE the live LLM scores,
 * so we can diff old↔new before any cutover. No live scoring/matching/advisor
 * path reads these *_v2 columns or profile_strength yet.
 *
 * Reads vv_user_vectors (built by vector-builder.ts) → writes:
 *   vv_match_scores.appeal_to_her_v2 / appeal_to_him_v2 / mutual_value_v2
 *   vv_user_vectors.profile_strength / profile_strength_band
 */

import { getSupabase } from './supabase';
import {
	appeal,
	mutualValue,
	profileStrength,
	profileStrengthBand,
	type Vec,
} from './vector-scoring';

interface UserVecRow {
	attributes: Vec;
	confidence: Vec;
	weights: Vec;
}

async function loadVectors(db: any, userId: string): Promise<UserVecRow | null> {
	const { data } = await db
		.from('vv_user_vectors')
		.select('attributes, confidence, weights')
		.eq('user_id', userId)
		.maybeSingle();
	if (!data) return null;
	return {
		attributes: (data.attributes ?? {}) as Vec,
		confidence: (data.confidence ?? {}) as Vec,
		weights: (data.weights ?? {}) as Vec,
	};
}

/** Compute + persist Profile Strength for one user (no-op if no vectors yet). */
export async function computeProfileStrengthForUser(userId: string): Promise<number | null> {
	const db = getSupabase() as any;
	const v = await loadVectors(db, userId);
	if (!v) return null;
	const ps = profileStrength(v.attributes, v.confidence);
	await db.from('vv_user_vectors')
		.update({ profile_strength: ps, profile_strength_band: profileStrengthBand(ps) })
		.eq('user_id', userId);
	return ps;
}

interface PairShadow {
	maleUserId: string;
	femaleUserId: string;
	appealToHerV2: number;
	appealToHimV2: number;
	mutualValueV2: number;
}

/**
 * Shadow-score one (male, female) pair from their vectors and upsert the *_v2
 * columns. appeal_to_her = how well HE satisfies what SHE weights; appeal_to_him
 * = the mirror. Returns null if either side has no vectors.
 */
export async function scorePairShadow(maleId: string, femaleId: string): Promise<PairShadow | null> {
	const db = getSupabase() as any;
	const [male, female] = await Promise.all([loadVectors(db, maleId), loadVectors(db, femaleId)]);
	if (!male || !female) return null;

	const appealToHerV2 = appeal(female.weights, male.attributes, male.confidence);
	const appealToHimV2 = appeal(male.weights, female.attributes, female.confidence);
	const mutualValueV2 = mutualValue(appealToHerV2, appealToHimV2);

	// Upsert only the v2 columns (leaves the live LLM appeal columns untouched on
	// existing rows; inserts a sparse row if the pair was never LLM-scored).
	await db.from('vv_match_scores').upsert({
		male_user_id: maleId,
		female_user_id: femaleId,
		appeal_to_her_v2: appealToHerV2,
		appeal_to_him_v2: appealToHimV2,
		mutual_value_v2: mutualValueV2,
		scored_v2_at: new Date().toISOString(),
	}, { onConflict: 'male_user_id,female_user_id' });

	return { maleUserId: maleId, femaleUserId: femaleId, appealToHerV2, appealToHimV2, mutualValueV2 };
}

/** Mutual-match (male,female) pairs across the platform. */
async function mutualPairs(db: any): Promise<Array<{ maleId: string; femaleId: string }>> {
	const { data: matches } = await db
		.from('verified_vibe_matches')
		.select('user1_id, user2_id')
		.eq('status', 'mutual');
	const ids = new Set<string>();
	for (const m of matches ?? []) { ids.add(m.user1_id); ids.add(m.user2_id); }
	if (!ids.size) return [];
	const { data: users } = await db
		.from('verified_vibe_users').select('id, gender').in('id', [...ids]);
	const gender: Record<string, string> = Object.fromEntries((users ?? []).map((u: any) => [u.id, u.gender]));
	const pairs: Array<{ maleId: string; femaleId: string }> = [];
	for (const m of matches ?? []) {
		const a = m.user1_id, b = m.user2_id;
		if (gender[a] === 'man' && gender[b] === 'woman') pairs.push({ maleId: a, femaleId: b });
		else if (gender[a] === 'woman' && gender[b] === 'man') pairs.push({ maleId: b, femaleId: a });
	}
	return pairs;
}

/**
 * Full shadow pass: compute Profile Strength for every user with vectors, and
 * shadow-score every mutual pair. Synchronous, cheap (pure arithmetic). Returns
 * counts for the runner.
 */
export async function runShadowScoring(): Promise<{ usersScored: number; pairsScored: number; pairsSkipped: number }> {
	const db = getSupabase() as any;

	const { data: vecUsers } = await db.from('vv_user_vectors').select('user_id');
	let usersScored = 0;
	for (const r of vecUsers ?? []) {
		const ps = await computeProfileStrengthForUser(r.user_id);
		if (ps !== null) usersScored++;
	}

	const pairs = await mutualPairs(db);
	let pairsScored = 0, pairsSkipped = 0;
	for (const p of pairs) {
		const res = await scorePairShadow(p.maleId, p.femaleId);
		if (res) pairsScored++; else pairsSkipped++;
	}

	return { usersScored, pairsScored, pairsSkipped };
}

/**
 * Old↔new diff for the admin gate: per mutual pair, the live LLM appeal vs the
 * vector appeal (and delta), plus each user's Profile Strength. Read-only.
 */
export async function diffScores(limit = 100): Promise<{
	pairs: Array<{
		maleUserId: string; femaleUserId: string;
		appealToHer: number | null; appealToHerV2: number | null; deltaHer: number | null;
		appealToHim: number | null; appealToHimV2: number | null; deltaHim: number | null;
		mutualValueV2: number | null;
	}>;
	profileStrength: Array<{ userId: string; profileStrength: number | null; band: string | null; weightsSource: string | null }>;
}> {
	const db = getSupabase() as any;
	const { data: scores } = await db
		.from('vv_match_scores')
		.select('male_user_id, female_user_id, appeal_to_her, appeal_to_her_v2, appeal_to_him, appeal_to_him_v2, mutual_value_v2')
		.not('appeal_to_her_v2', 'is', null)
		.limit(limit);

	const pairs = (scores ?? []).map((s: any) => ({
		maleUserId: s.male_user_id,
		femaleUserId: s.female_user_id,
		appealToHer: s.appeal_to_her ?? null,
		appealToHerV2: s.appeal_to_her_v2 ?? null,
		deltaHer: s.appeal_to_her != null && s.appeal_to_her_v2 != null ? s.appeal_to_her_v2 - s.appeal_to_her : null,
		appealToHim: s.appeal_to_him ?? null,
		appealToHimV2: s.appeal_to_him_v2 ?? null,
		deltaHim: s.appeal_to_him != null && s.appeal_to_him_v2 != null ? s.appeal_to_him_v2 - s.appeal_to_him : null,
		mutualValueV2: s.mutual_value_v2 ?? null,
	}));

	const { data: vecs } = await db
		.from('vv_user_vectors')
		.select('user_id, profile_strength, profile_strength_band, weights_source')
		.not('profile_strength', 'is', null)
		.order('profile_strength', { ascending: false })
		.limit(limit);
	const profileStrength = (vecs ?? []).map((v: any) => ({
		userId: v.user_id,
		profileStrength: v.profile_strength ?? null,
		band: v.profile_strength_band ?? null,
		weightsSource: v.weights_source ?? null,
	}));

	return { pairs, profileStrength };
}
