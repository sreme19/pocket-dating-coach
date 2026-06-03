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
 * Cohort = same gender, real (is_seed=false), active within ACTIVE_WINDOW_DAYS.
 */

import { getSupabase } from './supabase';
import { recomputeRawTrust, refreshPoolBandIfEnrolled } from './trust-recompute';

const ACTIVE_WINDOW_DAYS = 7;
const COLD_START_FULL_N = 30;   // cohort size at which we trust the percentile fully
const IDENTITY_PENALTY = 0.5;   // multiplier applied when ID + liveness aren't done

/**
 * Pure normalization: map a raw score to its displayed trust score against a
 * cohort of raw scores. `cohortRaws` MUST include this user's own raw score.
 * Reused by the (Phase 2) what-if simulator to predict percentile deltas.
 */
export function normalizeScore(
	rawTrust: number,
	identityVerified: boolean,
	cohortRaws: number[]
): number {
	const n = cohortRaws.length;
	const percentile = n > 0
		? (cohortRaws.filter((r) => r <= rawTrust).length / n) * 100
		: rawTrust;
	const w = Math.min(1, n / COLD_START_FULL_N);
	const blended = w * percentile + (1 - w) * rawTrust;
	const penalized = identityVerified ? blended : blended * IDENTITY_PENALTY;
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
	const { data } = await db
		.from('verified_vibe_users')
		.select('raw_trust')
		.eq('is_seed', false)
		.eq('gender', gender)
		.gte('last_active_at', activeCutoff());
	return (data ?? []).map((r: any) => r.raw_trust ?? 0);
}

/**
 * Normalize a single user against their current cohort and persist
 * normalized_trust + trust_score. Assumes raw_trust/identity_verified are already
 * persisted (recomputeRawTrust does that). Cheap enough to run per upload.
 */
export async function normalizeUser(userId: string): Promise<number | null> {
	try {
		const db = getSupabase() as any;
		const { data: user } = await db
			.from('verified_vibe_users')
			.select('gender, raw_trust, identity_verified')
			.eq('id', userId)
			.maybeSingle();
		if (!user) return null;

		const cohort = await fetchCohortRaws(db, user.gender);
		// Ensure the user's own raw is represented even if they're not in the
		// active cohort (e.g. scoring right after a long absence).
		const raw = user.raw_trust ?? 0;
		if (!cohort.length) cohort.push(raw);

		const normalized = normalizeScore(raw, !!user.identity_verified, cohort);

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
export async function runTrustNormalization(): Promise<
	Array<{ userId: string; firstName: string; gender: string; before: number; rawTrust: number; after: number }>
> {
	const db = getSupabase() as any;
	const { data: users } = await db
		.from('verified_vibe_users')
		.select('id, first_name, gender, trust_score')
		.eq('is_seed', false);

	if (!users?.length) return [];

	// 1. Recompute raw for everyone first so cohorts reflect current proofs.
	const raws = new Map<string, { raw: number; identityVerified: boolean }>();
	for (const u of users) {
		const r = await recomputeRawTrust(u.id);
		raws.set(u.id, { raw: r.rawTrust, identityVerified: r.identityVerified });
	}

	// 2. Build per-gender active cohorts from the fresh raw values.
	const cohorts: Record<string, number[]> = {};
	const cutoff = activeCutoff();
	const { data: activeUsers } = await db
		.from('verified_vibe_users')
		.select('id, gender')
		.eq('is_seed', false)
		.gte('last_active_at', cutoff);
	for (const au of activeUsers ?? []) {
		const raw = raws.get(au.id)?.raw ?? 0;
		(cohorts[au.gender] = cohorts[au.gender] || []).push(raw);
	}

	// 3. Normalize + persist everyone.
	const report = [];
	for (const u of users) {
		const { raw, identityVerified } = raws.get(u.id) ?? { raw: 0, identityVerified: false };
		const cohort = cohorts[u.gender]?.length ? cohorts[u.gender] : [raw];
		const after = normalizeScore(raw, identityVerified, cohort);
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
