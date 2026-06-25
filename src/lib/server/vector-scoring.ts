/**
 * Vector scoring engine — the cheap arithmetic core of the two-sided
 * weighted-value redesign (Design Appendix A). PURE functions only: no DB, no
 * env, no LLM. Everything is a weighted sum over the precomputed vectors, so it
 * is free to compute and exactly explainable (the property the what-if/coaching
 * depends on). DB I/O + shadow persistence live in vector-scoring-shadow.ts.
 *
 * Notation (Appendix A):
 *   v[u,d]  attribute level 0–100        w[u,d]  preference weight (Σ=1)
 *   c[u,d]  confidence 0–1               e[u,d] = v·c  effective value
 *   A(m→f) = Σ_d w[f,d]·v[m,d]·c[m,d]    (local appeal, 0–100)
 *   Val    = √(A(m→f)·A(f→m))            (mutual compatibility / matching edge)
 *   PS[u]  = Σ_{d∈open} w̄[d]·v·c         (Profile Strength, open dims only)
 */

import {
	ALL_DIMENSION_IDS,
	OPEN_DIMENSION_IDS,
	OPEN_DIMENSIONS,
	POPULATION_AVG_WEIGHTS,
	type DimensionId,
} from '$lib/verified-vibe/dimensions';

export type Vec = Record<string, number>;

const clamp0100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Local appeal A(subject→evaluator): how much of what the EVALUATOR weights the
 * SUBJECT brings, discounted by how proven it is. Uses ALL dimensions (open AND
 * sensitive — sensitive preferences are legitimate in the local layer, §4b).
 * Bounded 0–100 because the evaluator's weights sum to 1, v∈[0,100], c∈[0,1].
 */
export function appeal(evaluatorWeights: Vec, subjectAttrs: Vec, subjectConf: Vec): number {
	let sum = 0;
	for (const d of ALL_DIMENSION_IDS) {
		sum += (evaluatorWeights[d] ?? 0) * (subjectAttrs[d] ?? 0) * (subjectConf[d] ?? 0);
	}
	return clamp0100(sum);
}

/**
 * Mutual compatibility (the matching edge value). Geometric mean penalises
 * lopsidedness smoothly (§9d, recommended): a 90/10 pair scores 30, a balanced
 * 50/50 scores 50 — the hollow one-sided match is correctly deprioritised.
 * `min` is the conservative alternative.
 */
export function mutualValue(
	appealAToB: number,
	appealBToA: number,
	method: 'geometric' | 'min' = 'geometric',
): number {
	const a = Math.max(0, appealAToB);
	const b = Math.max(0, appealBToA);
	return method === 'min' ? Math.round(Math.min(a, b)) : Math.round(Math.sqrt(a * b));
}

/** Lopsided-match flag (§7): mutually-high is healthy, one-sided is fragile. */
export function isLopsided(appealAToB: number, appealBToA: number, gap = 35): boolean {
	return Math.abs(appealAToB - appealBToA) >= gap;
}

/**
 * Profile Strength: pool-wide standing over OPEN dims only, using the curated
 * population-average weights w̄ (which sum to 1 over open dims). Sensitive dims
 * (incl. raw looks) are excluded entirely (§8, §13a) — a biased global "worth"
 * number is exactly what this avoids.
 */
export function profileStrength(attrs: Vec, conf: Vec): number {
	let sum = 0;
	for (const d of OPEN_DIMENSION_IDS) {
		sum += (POPULATION_AVG_WEIGHTS[d] ?? 0) * (attrs[d] ?? 0) * (conf[d] ?? 0);
	}
	return clamp0100(sum);
}

/**
 * User-facing band for Profile Strength — shown as a band, never a raw worth
 * rank (§8 presentation rule, Open Q21). Thresholds are tunable.
 */
export function profileStrengthBand(ps: number): string {
	if (ps >= 70) return 'Top tier';
	if (ps >= 55) return 'Strong';
	if (ps >= 40) return 'Climbing';
	if (ps >= 25) return 'Building';
	return 'Getting started';
}

// Band thresholds (ascending). Keep in sync with profileStrengthBand().
const BAND_THRESHOLDS: Array<{ min: number; band: string }> = [
	{ min: 70, band: 'Top tier' },
	{ min: 55, band: 'Strong' },
	{ min: 40, band: 'Climbing' },
	{ min: 25, band: 'Building' },
	{ min: 0, band: 'Getting started' },
];

/**
 * Band + momentum for Profile Strength: which band, the next band up, and how
 * many points to reach it. Powers the "you're climbing / X to next tier" framing
 * (never a raw worth rank, §8/§17).
 */
export function bandProgress(ps: number): {
	band: string;
	nextBand: string | null;
	pointsToNextBand: number | null;
	progressInBand: number; // 0–1 toward the next band
} {
	const idx = BAND_THRESHOLDS.findIndex((b) => ps >= b.min);
	const band = BAND_THRESHOLDS[idx].band;
	if (idx === 0) return { band, nextBand: null, pointsToNextBand: null, progressInBand: 1 };
	const floor = BAND_THRESHOLDS[idx].min;
	const ceil = BAND_THRESHOLDS[idx - 1].min;
	const next = BAND_THRESHOLDS[idx - 1].band;
	const span = ceil - floor || 1;
	return {
		band,
		nextBand: next,
		pointsToNextBand: Math.max(0, ceil - ps),
		progressInBand: Math.max(0, Math.min(1, (ps - floor) / span)),
	};
}

/**
 * Standing within a specific person's stack (Appendix A §6): the subject's rank
 * among rivals all evaluated toward the SAME person. rank = 1 + #{rivals with
 * strictly higher appeal toward that person}.
 */
export function standingRank(subjectAppeal: number, rivalAppeals: number[]): { rank: number; pool: number } {
	const rank = 1 + rivalAppeals.filter((a) => a > subjectAppeal).length;
	return { rank, pool: rivalAppeals.length + 1 };
}

/**
 * Verification upside preview (Appendix A §7, §3a "locked standing"): if every
 * CLAIMED dimension were verified (c→1), what would Profile Strength become?
 * Honest by construction — it reflects only the user's own claims.
 */
export function upsidePreview(attrs: Vec, conf: Vec): { psNow: number; psVerified: number; deltaPS: number } {
	const verifiedConf: Vec = {};
	for (const d of ALL_DIMENSION_IDS) {
		verifiedConf[d] = (attrs[d] ?? 0) > 0 ? 1 : (conf[d] ?? 0);
	}
	const psNow = profileStrength(attrs, conf);
	const psVerified = profileStrength(attrs, verifiedConf);
	return { psNow, psVerified, deltaPS: round1(psVerified - psNow) };
}

/**
 * Per-dimension Profile-Strength upside: verifying which single OPEN dimension
 * (c→1) raises PS most? Powers "verify your income → +X" coaching, sorted by
 * impact. Skips dims already fully confident.
 */
export function upsideByDimension(attrs: Vec, conf: Vec): Array<{ dim: DimensionId; label: string; deltaPS: number }> {
	const base = profileStrength(attrs, conf);
	const out: Array<{ dim: DimensionId; label: string; deltaPS: number }> = [];
	for (const d of OPEN_DIMENSION_IDS) {
		if ((conf[d] ?? 0) >= 1) continue;
		const c2: Vec = { ...conf, [d]: 1 };
		const delta = round1(profileStrength(attrs, c2) - base);
		if (delta > 0) {
			out.push({ dim: d, label: OPEN_DIMENSIONS.find((x) => x.id === d)?.label ?? d, deltaPS: delta });
		}
	}
	return out.sort((a, b) => b.deltaPS - a.deltaPS);
}

/** Effective value vector e = v·c (per dim), for diagnostics/coaching. */
export function effectiveValue(attrs: Vec, conf: Vec): Vec {
	const e: Vec = {};
	for (const d of ALL_DIMENSION_IDS) e[d] = round1((attrs[d] ?? 0) * (conf[d] ?? 0));
	return e;
}
