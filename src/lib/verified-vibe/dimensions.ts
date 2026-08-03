/**
 * The fixed value-dimension taxonomy — the single shared vocabulary used by the
 * two-sided weighted-value scoring redesign (Scoring & Matching Design v0.3,
 * §4a/§4b). This module is the STABLE CONTRACT: every score (appeal, Profile
 * Strength, what-if) projects the same underlying data through these dimensions.
 *
 * Two classes, and the split is a HARD RULE (§4b):
 *   - OPEN dimensions: usable in BOTH local appeal AND Profile Strength.
 *   - SENSITIVE dimensions: LOCAL appeal ONLY — never in Profile Strength, because
 *     a global "value" number that moves with religion / nationality / ethnicity /
 *     genetic beauty is biased and indefensible. They remain legitimate PERSONAL
 *     preferences, so they live only in the per-pair local layer.
 *
 * Keep this file in lockstep with the Flutter mirror: mobile/lib/dimensions.dart.
 * Dimension IDs are persisted in vv_user_vectors and read by the scoring engine,
 * so IDs are append-only / never renamed once shipped.
 */

export type DimensionClass = 'open' | 'sensitive';

export interface DimensionDef {
	/** Stable persisted id — never rename once shipped. */
	id: string;
	/** Short user-facing label (used by the preference-weighting step). */
	label: string;
	/** Class governs whether it can enter Profile Strength (open) or not (sensitive). */
	cls: DimensionClass;
	/** Population-average preference weight w̄ used ONLY by Profile Strength (open dims). */
	avgWeight: number;
	/** Whether the attribute level is primarily measured (quantifiable) vs judged (soft). */
	kind: 'measured' | 'soft';
	/** One-line description for coaching / the weighting UI. */
	blurb: string;
}

// ── Open dimensions (§4a) — count in local appeal AND Profile Strength ──────────
export const OPEN_DIMENSIONS: DimensionDef[] = [
	{ id: 'financial',        label: 'Financial standing', cls: 'open', kind: 'measured', avgWeight: 0.16,
	  blurb: 'Verified income and assets — used to confirm someone is real and solvent.' },
	{ id: 'ambition',         label: 'Ambition & drive',                cls: 'open', kind: 'soft',     avgWeight: 0.12,
	  blurb: 'Career trajectory, goals, hustle.' },
	{ id: 'lifestyle',        label: 'Lifestyle & adventure',           cls: 'open', kind: 'soft',     avgWeight: 0.11,
	  blurb: 'Travel, experiences, how they spend their time.' },
	{ id: 'presentation',     label: 'Presentation & health',           cls: 'open', kind: 'measured', avgWeight: 0.13,
	  blurb: 'Fitness, grooming, style, photo quality & recency. Coachable for everyone.' },
	{ id: 'warmth',           label: 'Warmth & emotional intelligence', cls: 'open', kind: 'soft',     avgWeight: 0.12,
	  blurb: 'Kindness, empathy, how safe they feel to be around.' },
	{ id: 'intellect',        label: 'Intellect',                       cls: 'open', kind: 'soft',     avgWeight: 0.10,
	  blurb: 'Curiosity, depth, the way they think.' },
	{ id: 'humor',            label: 'Humor',                           cls: 'open', kind: 'soft',     avgWeight: 0.09,
	  blurb: 'Wit, playfulness, ability to make someone laugh.' },
	{ id: 'social_legitimacy',label: 'Social & professional legitimacy',cls: 'open', kind: 'measured', avgWeight: 0.09,
	  blurb: 'Verifiable standing — career, network, real-world credibility.' },
	{ id: 'family',           label: 'Family orientation',              cls: 'open', kind: 'soft',     avgWeight: 0.08,
	  blurb: 'Values around family, long-term intent.' },
];

// ── Sensitive dimensions (§4b) — LOCAL appeal ONLY, never Profile Strength ──────
export const SENSITIVE_DIMENSIONS: DimensionDef[] = [
	{ id: 'faith',       label: 'Faith / religion alignment',     cls: 'sensitive', kind: 'soft', avgWeight: 0,
	  blurb: 'Religious alignment — a personal preference, never a global value.' },
	{ id: 'nationality', label: 'Nationality / cultural background', cls: 'sensitive', kind: 'soft', avgWeight: 0,
	  blurb: 'Cultural background — a personal preference only.' },
	{ id: 'ethnicity',   label: 'Ethnicity / background',         cls: 'sensitive', kind: 'soft', avgWeight: 0,
	  blurb: 'Ethnic background — a personal preference only.' },
	{ id: 'looks',       label: 'Physical attractiveness',        cls: 'sensitive', kind: 'soft', avgWeight: 0,
	  blurb: 'Raw looks — powerful local preference, excluded from the global number (§5).' },
];

export const ALL_DIMENSIONS: DimensionDef[] = [...OPEN_DIMENSIONS, ...SENSITIVE_DIMENSIONS];

// ── Money dimensions — contribute to the total, never named as a draw ──────────
/**
 * Dimensions that are about someone's money.
 *
 * These still count toward Profile Strength and appeal: verifying them raises the
 * aggregate number like any other dimension. What they must never do is appear in
 * user-facing coaching as a reason someone is more appealing — "verify your
 * financial standing, it's the biggest lift to your standing" is exactly the
 * framing App Store guideline 1.1.4 flagged as compensated dating, and the product
 * spec is explicit that financial proof is a fraud check, not an attraction signal.
 *
 * `financial` carries the highest avgWeight of any open dimension (0.16), so it
 * wins the "highest-leverage move" sort more often than not. Filtering it out of
 * the NAMED lists is what keeps the aggregate honest without advertising money.
 *
 * Deliberately narrow: `social_legitimacy` is career and network credibility, not
 * wealth, and excluding it too would gut legitimate coaching.
 */
export const MONEY_DIMENSION_IDS = ['financial'] as const;

export function isMoneyDimension(id: string): boolean {
	return (MONEY_DIMENSION_IDS as readonly string[]).includes(id);
}

/**
 * Drop money dimensions from a list of things about to be named to a member.
 * Order is preserved, so the next-best non-money move simply moves up.
 */
export function withoutMoneyDimensions<T extends { dim: string }>(items: T[]): T[] {
	return items.filter((i) => !isMoneyDimension(i.dim));
}

export type DimensionId = string;

export const OPEN_DIMENSION_IDS: DimensionId[] = OPEN_DIMENSIONS.map((d) => d.id);
export const SENSITIVE_DIMENSION_IDS: DimensionId[] = SENSITIVE_DIMENSIONS.map((d) => d.id);
export const ALL_DIMENSION_IDS: DimensionId[] = ALL_DIMENSIONS.map((d) => d.id);

const BY_ID: Record<string, DimensionDef> = Object.fromEntries(ALL_DIMENSIONS.map((d) => [d.id, d]));
export function getDimension(id: string): DimensionDef | undefined {
	return BY_ID[id];
}
export function isOpenDimension(id: string): boolean {
	return BY_ID[id]?.cls === 'open';
}

/**
 * Population-average preference weights (w̄) over OPEN dims only, used by Profile
 * Strength: PS[u] = Σ_{d∈open} w̄[d]·v[u,d]·c[u,d]. Open avgWeights sum to 1 by
 * construction; sensitive dims are 0 (excluded from PS). Open Question §20: this
 * is the curated/fixed reference set (anti-drift) rather than live pool average —
 * change it only as a versioned, announced admin action (§6c recalibration rule).
 */
export const POPULATION_AVG_WEIGHTS: Record<string, number> = Object.fromEntries(
	OPEN_DIMENSIONS.map((d) => [d.id, d.avgWeight]),
);

/** c_min — the confidence floor for an honest-but-unproven claim (Appendix A §1). */
export const CONFIDENCE_MIN = 0.3;

/** A neutral/balanced preference-weight vector over all dims (cold-start default, §13b). */
export function balancedWeights(): Record<string, number> {
	const n = ALL_DIMENSION_IDS.length;
	return Object.fromEntries(ALL_DIMENSION_IDS.map((id) => [id, 1 / n]));
}
