/**
 * Trust normalization (Phase 1).
 *
 * raw_trust is absolute (how much a user has verified). The DISPLAYED trust
 * score is this value normalized against the user's rival cohort — so it
 * communicates competitive standing, not just effort. Per product decision the
 * normalized value IS the trust score (mirrored into verified_vibe_users.trust_score).
 *
 * Two design guards make that safe on a small/young platform:
 *
 *  1. Cold-start anchor — pure population percentile is meaningless at N=3
 *     (scores would jump in 33-point steps and swing when one rival joins). We
 *     blend the percentile with the raw score, confidence-weighted by cohort
 *     size: below COLD_START_FULL_N the score behaves almost absolutely (≈ raw),
 *     and smoothly becomes population-relative as real density grows.
 *
 *  2. Identity penalty — unverified identity (no ID + liveness) is heavily
 *     penalized rather than gated: the man stays in the pool but his score is
 *     multiplied down, and his Wingman is told to surface this as lever #1.
 *
 * Cohort = same gender, REAL (realMembersOnly — neither seed nor provisional),
 * active within ACTIVE_WINDOW_DAYS.
 *
 * That cohort definition is the reason member-state.ts exists. The percentile is
 * a ratio over the cohort, so anyone admitted to it moves everybody else's score
 * without any new evidence entering the system. /aibestie ad visitors get real
 * user rows, and at campaign volume they would have swamped the male cohort with
 * raw_trust = 0 rows and inflated every real man's percentile overnight.
 */

import { getSupabase } from './supabase';
import { recomputeRawTrust, refreshPoolBandIfEnrolled } from './trust-recompute';
import { realMembersOnly } from './member-state';

const ACTIVE_WINDOW_DAYS = 7;
const COLD_START_FULL_N = 30;   // cohort size at which we trust the percentile fully
/**
 * Multiplier applied when a member has not proved they are a live human.
 *
 * "Proved" means the LIVENESS step, not liveness + government ID. It used to
 * mean both, and that was wrong in a way that made the whole displayed scale
 * meaningless: government ID is not something this product asks for.
 * POOL_REQUIRED_STEPS is ['liveness','photos'], and its comment states that
 * "'id' / government ID is never part of pool eligibility — it only gates
 * spending/wealth proof uploads."
 *
 * So the penalty was halving almost everyone for skipping a step they were
 * never asked to take. Measured 2026-09-06 on live data: 123 of 127 real men
 * and 16 of 17 real women were being penalized, only 5 members of 144 had
 * completed both steps, and the median displayed score sat at 22 against a raw
 * median of 39. The Discover feed read "Low trust" for 118 of 127 men.
 *
 * It was also a double charge. Missing ID already costs raw trust once:
 * trust-recompute computes `subscores.identity = (idScore + livScore) / 2`,
 * which calculateCGTotal weights at 20%. Halving the normalized score on top
 * charged the same omission a second time, and far more heavily.
 *
 * Keyed on liveness the penalty does the job it was written for — someone who
 * never proved a live face is genuinely unproven, and the photo identity gate
 * depends on that same anchor selfie. If ID ever becomes required, key this on
 * `identityVerified` again rather than reintroducing a second penalty.
 */
const IDENTITY_PENALTY = 0.5;

/**
 * Pure normalization: map a raw score to its displayed trust score against a
 * cohort of raw scores. `cohortRaws` MUST include this user's own raw score.
 * Reused by the (Phase 2) what-if simulator to predict percentile deltas.
 */
export function normalizeScore(
	rawTrust: number,
	livenessVerified: boolean,
	cohortRaws: number[]
): number {
	const n = cohortRaws.length;
	const percentile = n > 0
		? (cohortRaws.filter((r) => r <= rawTrust).length / n) * 100
		: rawTrust;
	const w = Math.min(1, n / COLD_START_FULL_N);
	const blended = w * percentile + (1 - w) * rawTrust;
	const penalized = livenessVerified ? blended : blended * IDENTITY_PENALTY;
	return Math.round(Math.max(0, Math.min(100, penalized)));
}

/** ISO timestamp for the active-cohort cutoff. */
function activeCutoff(): string {
	return new Date(Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Fetch the raw-trust cohort for a gender: real, active users. Returns the list
 * of raw_trust values (nulls coerced to 0). Used as the denominator for percentile.
 */
async function fetchCohortRaws(db: any, gender: string): Promise<number[]> {
	const { data } = await realMembersOnly(
		db.from('verified_vibe_users').select('raw_trust')
	)
		.eq('gender', gender)
		.gte('last_active_at', activeCutoff());
	return (data ?? []).map((r: any) => r.raw_trust ?? 0);
}

/**
 * Normalize a single user against their current cohort and persist
 * normalized_trust + trust_score. Assumes raw_trust is already
 * persisted (recomputeRawTrust does that). Cheap enough to run per upload.
 */
export async function normalizeUser(userId: string): Promise<number | null> {
	try {
		const db = getSupabase() as any;
		const { data: user } = await db
			.from('verified_vibe_users')
			.select('gender, raw_trust')
			.eq('id', userId)
			.maybeSingle();
		if (!user) return null;

		// Liveness is read from the verification rows, not from the
		// identity_verified column: that column means ID *and* liveness, and is
		// left alone because match-scoring reads it. See IDENTITY_PENALTY.
		const { data: livenessRow } = await db
			.from('verified_vibe_verification')
			.select('user_id')
			.eq('user_id', userId)
			.eq('step', 'liveness')
			.eq('status', 'completed')
			.maybeSingle();
		const livenessVerified = !!livenessRow;

		const cohort = await fetchCohortRaws(db, user.gender);
		// Ensure the user's own raw is represented even if they're not in the
		// active cohort (e.g. scoring right after a long absence).
		const raw = user.raw_trust ?? 0;
		if (!cohort.length) cohort.push(raw);

		const normalized = normalizeScore(raw, livenessVerified, cohort);

		await db
			.from('verified_vibe_users')
			.update({
				normalized_trust: normalized,
				trust_score: normalized,
				trust_updated_at: new Date().toISOString(),
			})
			.eq('id', userId);

		// Band now reflects the normalized (displayed) score.
		await refreshPoolBandIfEnrolled(userId);

		return normalized;
	} catch (e) {
		console.warn('normalizeUser failed (non-fatal):', e);
		return null;
	}
}

/**
 * Recompute raw trust AND normalize, in order — the single entry point upload
 * handlers call after persisting a new proof/artifact. Returns both scores.
 */
export async function recomputeAndNormalize(
	userId: string
): Promise<{ rawTrust: number; normalizedTrust: number; identityVerified: boolean }> {
	const raw = await recomputeRawTrust(userId);
	const normalized = await normalizeUser(userId);
	return {
		rawTrust: raw.rawTrust,
		normalizedTrust: normalized ?? raw.rawTrust,
		identityVerified: raw.identityVerified,
	};
}

/**
 * Full population pass (nightly / one-time backfill). Recomputes raw trust for
 * every real user, then normalizes everyone against their freshly-computed
 * cohort. Returns a before/after report for review. Seeds are left untouched.
 */
export async function runTrustNormalization(
	opts: { maxUsers?: number } = {}
): Promise<
	Array<{ userId: string; firstName: string; gender: string; before: number; rawTrust: number; after: number }>
> {
	const db = getSupabase() as any;

	// Stalest first, so repeated calls converge instead of redoing the same head
	// of the list. The pass costs roughly two seconds per member (a raw recompute
	// reads every proof source), and at 146 real members it stopped fitting in
	// one invocation: on 2026-09-06 it hit Vercel's 300s ceiling — already the
	// maximum, so there is no bigger number to reach for — after rewriting 29 of
	// them, leaving the other 117 on the previous scoring rule. A half-migrated
	// trust table is worse than either rule applied consistently.
	//
	// `maxUsers` lets a caller take a bite that comfortably fits, and ordering by
	// trust_updated_at means the next bite picks up exactly where this one
	// stopped. Nulls first: a member who has never been normalized has no score
	// at all and is the most urgent, not the least.
	let query = realMembersOnly(
		db.from('verified_vibe_users').select('id, first_name, gender, trust_score')
	).order('trust_updated_at', { ascending: true, nullsFirst: true });
	if (opts.maxUsers) query = query.limit(opts.maxUsers);
	const { data: users } = await query;

	if (!users?.length) return [];

	// 1. Recompute raw for everyone first so cohorts reflect current proofs.
	const raws = new Map<string, { raw: number; livenessVerified: boolean }>();
	for (const u of users) {
		const r = await recomputeRawTrust(u.id);
		raws.set(u.id, { raw: r.rawTrust, livenessVerified: r.livenessVerified });
	}

	// 2. Build per-gender active cohorts from the fresh raw values.
	const cohorts: Record<string, number[]> = {};
	const cutoff = activeCutoff();
	const { data: activeUsers } = await realMembersOnly(
		db.from('verified_vibe_users').select('id, gender')
	).gte('last_active_at', cutoff);
	for (const au of activeUsers ?? []) {
		const raw = raws.get(au.id)?.raw ?? 0;
		(cohorts[au.gender] = cohorts[au.gender] || []).push(raw);
	}

	// 3. Normalize + persist everyone.
	const report = [];
	for (const u of users) {
		const { raw, livenessVerified } = raws.get(u.id) ?? { raw: 0, livenessVerified: false };
		const cohort = cohorts[u.gender]?.length ? cohorts[u.gender] : [raw];
		const after = normalizeScore(raw, livenessVerified, cohort);
		await db
			.from('verified_vibe_users')
			.update({ normalized_trust: after, trust_score: after, trust_updated_at: new Date().toISOString() })
			.eq('id', u.id);
		await refreshPoolBandIfEnrolled(u.id);
		report.push({
			userId: u.id, firstName: u.first_name, gender: u.gender,
			before: u.trust_score ?? 0, rawTrust: raw, after,
		});
	}
	return report;
}
