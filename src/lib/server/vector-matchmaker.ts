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

/**
 * Write the vv_matchmaker_runs audit row. Non-fatal by design: a failure to log
 * must never take down a real matching run. Returns the row id, or null.
 *
 * The v2 path had no audit trail at all until 2026-08-03 — an on-demand v2 run
 * fired 85 matches that quite literally left no trace in this table, so the
 * "did the nightly work?" check silently reported nothing rather than success.
 */
async function logRunStart(db: any, runType: 'nightly' | 'on_demand'): Promise<string | null> {
	try {
		const { data } = await db
			.from('vv_matchmaker_runs')
			.insert({
				run_type: runType,
				city: null,
				pairs_evaluated: 0, hard_filtered: 0, soft_scored: 0, matches_fired: 0, soft_overrides: 0,
			})
			.select('id')
			.single();
		return data?.id ?? null;
	} catch (err) {
		console.error('[vector-matchmaker] failed to open audit row:', err);
		return null;
	}
}

/**
 * Close the audit row. Sets completed_at ONLY on success, preserving the
 * invariant that completed_at IS NULL means "this run did not finish" — the
 * exact signal that exposed the fire-and-forget nightly bug. On failure we
 * record `error` and deliberately leave completed_at NULL.
 */
async function logRunEnd(db: any, runId: string | null, fields: Record<string, unknown>): Promise<void> {
	if (!runId) return;
	try {
		await db.from('vv_matchmaker_runs').update(fields).eq('id', runId);
	} catch (err) {
		console.error('[vector-matchmaker] failed to close audit row:', err);
	}
}

export async function runVectorMatchmaker(
	opts: { dryRun?: boolean; caps?: MatchCaps; runType?: 'nightly' | 'on_demand' } = {},
): Promise<VectorMatchResult> {
	const db = getSupabase() as any;
	const caps = opts.caps ?? DEFAULT_CAPS;
	const dryRun = opts.dryRun ?? false;

	// Dry runs never touch the audit trail — the table means "real runs".
	const runId = dryRun ? null : await logRunStart(db, opts.runType ?? 'nightly');

	try {
	const [menIds, womenIds] = await Promise.all([loadActive(db, 'wingman'), loadActive(db, 'bestie')]);
	const vectors = await ensureVectors(db, [...menIds, ...womenIds]);
	const men = menIds.map((id) => vectors.get(id)).filter(Boolean) as ActiveUser[];
	const women = womenIds.map((id) => vectors.get(id)).filter(Boolean) as ActiveUser[];

	if (!men.length || !women.length) {
		// Empty pool is a legitimate completed run, not a failure.
		await logRunEnd(db, runId, { completed_at: new Date().toISOString() });
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
	const newMatchIds: string[] = [];
	for (const a of assignments) {
		const isNew = !existingSet.has([a.manId, a.womanId].sort().join(':'));
		if (!isNew) alreadyMatched++;
		if (sample.length < 25) sample.push({ manId: a.manId, womanId: a.womanId, value: a.value, phase: a.phase, isNew });
		if (isNew && !dryRun) {
			const { data: created, error } = await db.from('verified_vibe_matches').insert({
				user1_id: a.manId, user2_id: a.womanId, status: 'mutual', source: 'matchmaker', ai_bestie_active: true,
			}).select('id').single();
			if (!error) {
				fired++;
				if (created?.id) newMatchIds.push(created.id);
				await Promise.allSettled([
					sendMatchNotification(a.manId, a.womanId),
					sendMatchNotification(a.womanId, a.manId),
				]);
			}
		} else if (isNew && dryRun) {
			fired++; // would-fire count in dry-run
		}
	}

	// Bestie speaks first: proactively open each freshly-formed match on the
	// woman's behalf. Bounded concurrency to respect model rate limits; each call
	// is idempotent + non-fatal. This is an admin batch action, so we await.
	if (newMatchIds.length) {
		const { generateAndSendBestieOpener } = await import('./bestie-responder');
		const CONCURRENCY = 4;
		for (let i = 0; i < newMatchIds.length; i += CONCURRENCY) {
			await Promise.allSettled(
				newMatchIds.slice(i, i + CONCURRENCY).map((id) => generateAndSendBestieOpener(id)),
			);
		}
	}

	// Field semantics mirror the legacy runNightlyBatch so both matchers land in
	// one comparable history: pairs_evaluated = every man×woman pair considered,
	// soft_scored = pairs that survived top-K candidate filtering, soft_overrides
	// = phase-2 assignments (matched outside stated preferences).
	await logRunEnd(db, runId, {
		completed_at: new Date().toISOString(),
		pairs_evaluated: men.length * women.length,
		hard_filtered: Math.max(0, men.length * women.length - candidates.length),
		soft_scored: candidates.length,
		matches_fired: fired,
		soft_overrides: assignments.filter((a) => a.phase === 2).length,
	});

	return {
		dryRun, men: men.length, women: women.length,
		proposed: assignments.length, fired, alreadyMatched, caps, sample,
	};
	} catch (err: any) {
		// Record the failure but leave completed_at NULL: an unfinished run must
		// stay visibly unfinished, so a killed or crashed batch can never be
		// mistaken for a successful one.
		await logRunEnd(db, runId, { error: err?.message ?? String(err) });
		throw err;
	}
}
