/**
 * Proof categories — the single source of truth.
 *
 * Before this file, the same taxonomy existed in four places that disagreed about
 * which categories even EXIST:
 *
 *   - `trust-recompute.ts` PROOF_BOOST_MAP     — 11 ids, no `travel`, no `wealth`
 *   - `proof-signals.ts` PROOF_REQUEST_CATEGORIES — 8 ids, no hosting/instagram/…
 *   - `vector-builder.ts` PROOF_CONFIDENCE      — 13 ids, no `travel`
 *   - `CasualGenerousBoostTab.svelte`           — its own "pts" numbers, which
 *                                                 match no server weight at all
 *
 * That drift was not cosmetic. `trust-recompute` skips any category it does not
 * recognise (`if (!b) continue`), so `proof_travel` and `proof_wealth` uploads
 * earned NOTHING — six uploads across six real members, and Travel Magnets is a
 * whole documented section of the product. Deriving every consumer from this list
 * makes that class of silent gap impossible: adding a category here is the only
 * way to add one, and a missing weight is a type error rather than a no-op.
 *
 * Numbers are unchanged from the previous server behaviour except where a category
 * had no weight at all — see TRUST_BOOST notes.
 */

import type { DimensionId } from '$lib/verified-vibe/dimensions';
import { isMoneyDimension } from '$lib/verified-vibe/dimensions';

/** The Casual-Generous trust subscore a proof credits. */
export type TrustSubscoreKey =
	| 'identity'
	| 'lifestyleDepth'
	| 'lifestyleSignals'
	| 'emotionalSafety'
	| 'socialLegitimacy';

export interface ProofCategoryDef {
	id: string;
	/** Short label for UI. */
	label: string;
	/** How the advisor should ask for it, in plain member language. */
	askPhrase: string;
	/** Trust subscore credited, and by how much. */
	trust: { key: TrustSubscoreKey; boost: number };
	/** Vector-model confidence this proof establishes, per dimension. */
	dims: Partial<Record<DimensionId, number>>;
	/** Show-off categories scale with how many photos were supplied. */
	showOff: boolean;
	/**
	 * Needs a name-bearing document matched against a verified government ID, so
	 * the in-chat picture-only surface must never ask for it.
	 */
	documentGated: boolean;
}

/**
 * Every proof category, in the priority order the advisor should prefer when
 * several gaps are open: lowest friction and highest leverage first, with the
 * ID-gated document categories trailing.
 */
export const PROOF_CATEGORIES: ProofCategoryDef[] = [
	{
		id: 'linkedin',
		label: 'Career',
		askPhrase: 'career (a LinkedIn screenshot, or your résumé)',
		trust: { key: 'socialLegitimacy', boost: 50 },
		dims: { social_legitimacy: 0.7, ambition: 0.4 },
		showOff: false,
		documentGated: false
	},
	{
		id: 'discipline',
		label: 'Fitness & discipline',
		askPhrase: 'fitness / discipline (you at the gym, training, sport)',
		trust: { key: 'emotionalSafety', boost: 35 },
		dims: { presentation: 0.6 },
		showOff: true,
		documentGated: false
	},
	{
		id: 'travel',
		label: 'Travel',
		askPhrase: 'travel (passport stamps, boarding passes, trip photos with you in them)',
		// NEW WEIGHT. travel was absent from PROOF_BOOST_MAP entirely, so five
		// members' uploads scored zero. Pitched at `lifestyle`'s 30 minus a little,
		// since a stamp evidences less of someone's week-to-week life than a run of
		// lifestyle photos does.
		trust: { key: 'lifestyleDepth', boost: 25 },
		dims: { lifestyle: 0.55 },
		showOff: true,
		documentGated: false
	},
	{
		id: 'lifestyle',
		label: 'Lifestyle',
		askPhrase: 'lifestyle (photos of you living it — dining, events, experiences)',
		trust: { key: 'lifestyleDepth', boost: 30 },
		dims: { lifestyle: 0.6, presentation: 0.15 },
		showOff: true,
		documentGated: false
	},
	{
		id: 'social_proof',
		label: 'Social life',
		askPhrase: 'social life (you with friends, at events)',
		trust: { key: 'socialLegitimacy', boost: 30 },
		dims: { social_legitimacy: 0.4, warmth: 0.1 },
		showOff: true,
		documentGated: false
	},
	{
		id: 'hosting',
		label: 'Hosting',
		askPhrase: 'hosting (a dinner or gathering you put on)',
		trust: { key: 'lifestyleDepth', boost: 20 },
		dims: { lifestyle: 0.4, warmth: 0.2 },
		showOff: true,
		documentGated: false
	},
	{
		id: 'intro',
		label: 'Intro video',
		askPhrase: 'a short intro video of yourself',
		trust: { key: 'emotionalSafety', boost: 45 },
		dims: { warmth: 0.4, presentation: 0.2 },
		showOff: false,
		documentGated: false
	},
	{
		id: 'instagram',
		label: 'Instagram',
		askPhrase: 'your Instagram',
		trust: { key: 'socialLegitimacy', boost: 25 },
		dims: { social_legitimacy: 0.3, lifestyle: 0.1 },
		showOff: false,
		documentGated: false
	},
	{
		id: 'habit_tracker',
		label: 'Habits',
		askPhrase: 'a habit or training streak',
		trust: { key: 'socialLegitimacy', boost: 20 },
		dims: { presentation: 0.3 },
		showOff: false,
		documentGated: false
	},
	{
		id: 'twitter',
		label: 'X / Twitter',
		askPhrase: 'your X profile',
		trust: { key: 'socialLegitimacy', boost: 15 },
		dims: { social_legitimacy: 0.2, intellect: 0.1 },
		showOff: false,
		documentGated: false
	},
	{
		id: 'assets',
		label: 'Assets',
		askPhrase: 'ownership papers for your car or other big things (needs verified ID)',
		trust: { key: 'lifestyleSignals', boost: 35 },
		dims: { financial: 0.6 },
		showOff: false,
		documentGated: true
	},
	{
		id: 'wealth',
		label: 'Financial verification',
		askPhrase: 'a bank statement or payslip (needs verified ID)',
		// NEW WEIGHT. wealth was absent from PROOF_BOOST_MAP, so one member's
		// upload scored zero. Set level with `assets`, which it sits beside.
		trust: { key: 'lifestyleSignals', boost: 35 },
		dims: { financial: 0.7 },
		showOff: false,
		documentGated: true
	},
	{
		id: 'spending',
		label: 'Spending',
		askPhrase: 'receipts or bills (needs verified ID)',
		trust: { key: 'lifestyleSignals', boost: 30 },
		dims: { financial: 0.5 },
		showOff: false,
		documentGated: true
	}
];

export const PROOF_CATEGORY_IDS: string[] = PROOF_CATEGORIES.map((c) => c.id);

const BY_ID = new Map(PROOF_CATEGORIES.map((c) => [c.id, c]));

export function proofCategory(id: string): ProofCategoryDef | undefined {
	return BY_ID.get(id);
}

/**
 * True when this category is only about money.
 *
 * Money proofs still count toward the aggregate, but must never be NAMED to a
 * member as something that makes them more appealing — see the money rule in
 * dimensions.ts. A category counts as money when every dimension it evidences is
 * a money dimension, so `lifestyle` (which touches nothing financial) stays
 * coachable while `wealth` does not.
 */
export function isMoneyProofCategory(id: string): boolean {
	const def = BY_ID.get(id);
	if (!def) return false;
	const dims = Object.keys(def.dims);
	return dims.length > 0 && dims.every((d) => isMoneyDimension(d));
}

/**
 * What this member has NOT yet proven, in the order worth asking for.
 *
 * Nothing in the codebase could answer this before: every helper returned the
 * positive space ("already verified — do not ask again"), which is why the advisor
 * prompt instructed the model to "speak qualitatively" about gaps, i.e. improvise.
 *
 * `completed` accepts either bare ids (`travel`) or verification steps
 * (`proof_travel`), since callers have both shapes to hand.
 */
export function missingProofCategories(
	completed: readonly string[],
	opts: { excludeDocumentGated?: boolean; excludeMoney?: boolean } = {}
): ProofCategoryDef[] {
	const done = new Set(completed.map((c) => c.replace(/^proof_/, '')));
	return PROOF_CATEGORIES.filter((c) => {
		if (done.has(c.id)) return false;
		if (opts.excludeDocumentGated && c.documentGated) return false;
		if (opts.excludeMoney && isMoneyProofCategory(c.id)) return false;
		return true;
	});
}

/** Portfolio completion, for the progress card. Document-gated categories count. */
export function proofPortfolioProgress(completed: readonly string[]): {
	done: number;
	total: number;
	missing: ProofCategoryDef[];
} {
	const missing = missingProofCategories(completed);
	return { done: PROOF_CATEGORIES.length - missing.length, total: PROOF_CATEGORIES.length, missing };
}
