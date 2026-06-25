/**
 * Vector matchmaker (Phase 3) — the cutover from per-pair LLM scoring to cheap
 * vector arithmetic + constrained min-cost-flow b-matching (Design §9, §12).
 *
 * Replaces runNightlyBatch's O(N×M) Claude calls: appeal is a dot product over
 * precomputed vectors, so scoring the whole pool is free arithmetic; the only LLM
 * cost is building each person's vectors once on profile change (vector-builder).
 *
 * GATED behind the MATCHMAKER_V2 flag — when off, the legacy matcher runs
 * unchanged (zero regression). Supports a dry-run that proposes matches + diffs
 * against the current set WITHOUT firing, so we validate before flipping.
 *
 * Hysteresis (§9g): we ADD new matches and never delete existing ones, so a
 * re-solve doesn't yank yesterday's matches away.
 */

import { getSupabase } from './supabase';
import { appeal, mutualValue, type Vec } from './vector-scoring';
import { solveMatching, type MatchCandidate, type MatchCaps } from './vector-matching';
import { buildAndStoreUserVectors } from './vector-builder';
import { sendMatchNotification } from './matchmaker-service';

// Caps at the current gender skew (Design §9c / Open Q27 recommendation).
export const DEFAULT_CAPS: MatchCaps = { manFloor: 1, manCap: 4, womanCap: 12 };
const LAMBDA = 0.15;          // assortative soft-cost weight
const VALUE_THRESHOLD = 15;   // quality-phase floor on the vector scale (calibration: appeal ~18–49)
const TOP_K = 50;             // cap candidates per person to bound the graph (§9: candidate generation)

interface ActiveUser {
	userId: string;
	attributes: Vec;
	confidence: Vec;
	weights: Vec;
	profileStrength: number;
}

async function loadActive(db: any, assistant: 'wingman' | 'bestie'): Promise<string[]> {
	const { data } = await db
		.from('vv_pool_profiles')
		.select('user_id')
		.eq('assistant_type', assistant)
		.eq('availability_status', 'active');
	return (data ?? []).map((r: any) => r.user_id);
}

/** Ensure every active user has vectors; build the missing ones (LLM, bounded). */
async function ensureVectors(db: any, userIds: string[]): Promise<Map<string, ActiveUser>> {
	const { data: existing } = await db
		.from('vv_user_vectors')
		.select('user_id, attributes, confidence, weights, profile_strength')
		.in('user_id', userIds);
	const have = new Map<string, any>((existing ?? []).map((r: any) => [r.user_id, r]));

	const out = new Map<string, ActiveUser>();
	for (const id of userIds) {
		let row = have.get(id);
		if (!row || !row.attributes || Object.keys(row.attributes).length === 0) {
			const built = await buildAndStoreUserVectors(id); // 1 LLM call
			if (!built) continue;
			row = { attributes: built.attributes, confidence: built.confidence, weights: built.weights, profile_strength: null };
		}
		out.set(id, {
			userId: id,
			attributes: (row.attributes ?? {}) as Vec,
			confidence: (row.confidence ?? {}) as Vec,
			weights: (row.weights ?? {}) as Vec,
			profileStrength: row.profile_strength ?? 0,
		});
	}
	return out;
}

/** Build candidate edges (mutual value + PS gap), keeping each person's top-K. */
function buildCandidates(
	men: ActiveUser[], women: ActiveUser[],
): MatchCandidate[] {
	const all: MatchCandidate[] = [];
	for (const m of men) {
		for (const w of women) {
			const appealToHer = appeal(w.weights, m.attributes, m.confidence);
			const appealToHim = appeal(m.weights, w.attributes, w.confidence);
			all.push({
				manId: m.userId,
				womanId: w.userId,
				value: mutualValue(appealToHer, appealToHim),
				psGap: Math.abs(m.profileStrength - w.profileStrength),
			});
		}
	}
	// Top-K per man and per woman (union) to bound the graph.
	const keep = new Set<string>();
	const topKBy = (key: (c: MatchCandidate) => string) => {
		const groups = new Map<string, MatchCandidate[]>();
		for (const c of all) (groups.get(key(c)) ?? groups.set(key(c), []).get(key(c))!).push(c);
		for (const list of groups.values()) {
			list.sort((a, b) => b.value - a.value);
			for (const c of list.slice(0, TOP_K)) keep.add(`${c.manId}:${c.womanId}`);
		}
	};
	topKBy((c) => c.manId);
	topKBy((c) => c.womanId);
	return all.filter((c) => keep.has(`${c.manId}:${c.womanId}`));
}

export interface VectorMatchResult {
	dryRun: boolean;
	men: number;
	women: number;
	proposed: number;
	fired: number;
	alreadyMatched: number;
	caps: MatchCaps;
	sample: Array<{ manId: string; womanId: string; value: number; phase: 1 | 2; isNew: boolean }>;
}

export async function runVectorMatchmaker(opts: { dryRun?: boolean; caps?: MatchCaps } = {}): Promise<VectorMatchResult> {
	const db = getSupabase() as any;
	const caps = opts.caps ?? DEFAULT_CAPS;
	const dryRun = opts.dryRun ?? false;

	const [menIds, womenIds] = await Promise.all([loadActive(db, 'wingman'), loadActive(db, 'bestie')]);
	const vectors = await ensureVectors(db, [...menIds, ...womenIds]);
	const men = menIds.map((id) => vectors.get(id)).filter(Boolean) as ActiveUser[];
	const women = womenIds.map((id) => vectors.get(id)).filter(Boolean) as ActiveUser[];

	if (!men.length || !women.length) {
		return { dryRun, men: men.length, women: women.length, proposed: 0, fired: 0, alreadyMatched: 0, caps, sample: [] };
	}

	const candidates = buildCandidates(men, women);
	const assignments = solveMatching(
		men.map((m) => m.userId), women.map((w) => w.userId),
		candidates, caps, { lambda: LAMBDA, valueThreshold: VALUE_THRESHOLD },
	);

	// Existing matches (hysteresis: keep them; only fire genuinely new pairs).
	const { data: existing } = await db.from('verified_vibe_matches').select('user1_id, user2_id');
	const existingSet = new Set<string>((existing ?? []).map((m: any) => [m.user1_id, m.user2_id].sort().join(':')));

	let fired = 0, alreadyMatched = 0;
	const sample: VectorMatchResult['sample'] = [];
	for (const a of assignments) {
		const isNew = !existingSet.has([a.manId, a.womanId].sort().join(':'));
		if (!isNew) alreadyMatched++;
		if (sample.length < 25) sample.push({ manId: a.manId, womanId: a.womanId, value: a.value, phase: a.phase, isNew });
		if (isNew && !dryRun) {
			const { error } = await db.from('verified_vibe_matches').insert({
				user1_id: a.manId, user2_id: a.womanId, status: 'mutual', ai_bestie_active: true,
			});
			if (!error) {
				fired++;
				await Promise.allSettled([
					sendMatchNotification(a.manId, a.womanId),
					sendMatchNotification(a.womanId, a.manId),
				]);
			}
		} else if (isNew && dryRun) {
			fired++; // would-fire count in dry-run
		}
	}

	return {
		dryRun, men: men.length, women: women.length,
		proposed: assignments.length, fired, alreadyMatched, caps, sample,
	};
}
