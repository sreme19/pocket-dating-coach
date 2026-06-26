/**
 * Quantifiable-attribute valuation (Design §6c/§6d) — deterministic, auditable,
 * city-calibrated. The LLM extracts the raw fact (income); a FIXED curve maps it
 * to an attribute level v, so the score is reproducible and not gameable by
 * eyeballing. Absolute curve (not a pool percentile), so a new high earner joining
 * never silently drops anyone else's v.
 *
 * Income is in LPA (lakhs/annum — the platform's primary market). The curve is
 * concave + saturating, anchored to the doc's reference points:
 *   10 LPA → ~45 · 20 → ~62 · 30 → ~72   (diminishing returns, ceiling 100).
 * Fitted v = A + B·ln(adjustedIncome), with A=-11.4, B=24.5 (matches all three
 * anchors), clamped to [0,100].
 *
 * Cost-of-living: adjusted = nominal / COL_index[cityTier]; cheaper city → higher
 * adjusted income → higher v (same salary affords a better local lifestyle).
 * Start coarse with city tiers; refine to specific-city indices later.
 */

const CURVE_A = -11.4;
const CURVE_B = 24.5;

export type CityTier = 'metro' | 'tier1' | 'tier2' | 'tier3';

/** Versioned COL index per tier (cheaper city < 1). Recalibrate only as a
 *  deliberate, announced admin action (§6c) — never silent per-signup drift. */
export const COL_INDEX: Record<CityTier, number> = {
	metro: 1.4,  // very-high-cost metros (Mumbai, Bangalore core, Delhi NCR core)
	tier1: 1.15, // large cities
	tier2: 0.9,  // mid cities
	tier3: 0.7,  // smaller cities / towns
};
export const COL_INDEX_DEFAULT = 1.0; // unknown city → neutral baseline (§6d relocation rule)

// Coarse city → tier seed. Substring match on a normalised city string. Extend
// freely; unknown cities fall back to the neutral baseline.
const CITY_TIER_HINTS: Array<{ match: string; tier: CityTier }> = [
	{ match: 'mumbai', tier: 'metro' }, { match: 'bangalore', tier: 'metro' },
	{ match: 'bengaluru', tier: 'metro' }, { match: 'delhi', tier: 'metro' },
	{ match: 'gurgaon', tier: 'metro' }, { match: 'gurugram', tier: 'metro' },
	{ match: 'new york', tier: 'metro' }, { match: 'san francisco', tier: 'metro' },
	{ match: 'london', tier: 'metro' }, { match: 'singapore', tier: 'metro' },
	{ match: 'hyderabad', tier: 'tier1' }, { match: 'pune', tier: 'tier1' },
	{ match: 'chennai', tier: 'tier1' }, { match: 'kolkata', tier: 'tier1' },
	{ match: 'ahmedabad', tier: 'tier2' }, { match: 'jaipur', tier: 'tier2' },
	{ match: 'kochi', tier: 'tier2' }, { match: 'lucknow', tier: 'tier2' },
	{ match: 'indore', tier: 'tier2' }, { match: 'coimbatore', tier: 'tier2' },
];

export function cityTier(city: string | null | undefined): CityTier | null {
	if (!city) return null;
	const c = city.toLowerCase();
	for (const h of CITY_TIER_HINTS) if (c.includes(h.match)) return h.tier;
	return null;
}

export function colIndexForCity(city: string | null | undefined): number {
	const tier = cityTier(city);
	return tier ? COL_INDEX[tier] : COL_INDEX_DEFAULT;
}

/** The absolute base curve: LPA → 0–100. Concave/saturating, clamped. */
export function incomeBaseCurve(incomeLPA: number): number {
	if (!isFinite(incomeLPA) || incomeLPA <= 0) return 0;
	const v = CURVE_A + CURVE_B * Math.log(incomeLPA);
	return Math.max(0, Math.min(100, Math.round(v)));
}

/** City-calibrated income valuation: v = base_curve(income / COL_index[city]). */
export function incomeToV(incomeLPA: number, city: string | null | undefined): number {
	if (!isFinite(incomeLPA) || incomeLPA <= 0) return 0;
	return incomeBaseCurve(incomeLPA / colIndexForCity(city));
}

/**
 * Tolerant parse of a free-text income string → LPA. Handles "20", "20 LPA",
 * "₹20,00,000", "2000000", "₹18L", "1.2 cr". Returns null if no number found.
 * Heuristic: explicit unit wins; otherwise a bare number ≥ 100000 is treated as
 * absolute rupees (→ /1e5 to LPA), and a smaller bare number is treated as LPA.
 */
export function parseIncomeToLPA(raw: unknown): number | null {
	if (typeof raw === 'number' && isFinite(raw)) return raw >= 100000 ? raw / 1e5 : raw;
	if (typeof raw !== 'string') return null;
	const s = raw.toLowerCase().replace(/[, ]/g, '');
	const m = s.match(/(\d+(?:\.\d+)?)/);
	if (!m) return null;
	const n = parseFloat(m[1]);
	if (!isFinite(n) || n <= 0) return null;
	if (/cr|crore/.test(s)) return n * 100;       // 1 cr = 100 LPA
	if (/lpa|lakh|lac|l\b|l$/.test(s)) return n;  // already LPA
	if (/k\b|k$/.test(s)) return (n * 1000) / 1e5; // thousands (rupees) → LPA
	return n >= 100000 ? n / 1e5 : n;             // bare: large → rupees, else LPA
}
