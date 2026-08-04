/**
 * gap-bar.ts — the man's four-stage progress toward a hand-off.
 *
 * Replaces the `0/2 cleared` counter he used to see, which told him nothing: two
 * of what, and what moves it? This is a percentage with named stages, and every
 * point of it is something he can act on.
 *
 * THE ONE RULE THAT SHAPES EVERYTHING: it is ABSOLUTE, never a ranking. The
 * original brief had stage 3 score him against her other suitors, so 90% meant
 * "top 3 of them". The median woman here has 14 suitors, so that gate admits three
 * and permanently closes the path for eleven — men who did everything asked and
 * still cannot move, because the thing blocking them is other people's uploads.
 * The requirement doc already draws this line: Profile Strength and appeal-to-a-
 * match may be "stated plainly" because they depend only on him and on her, while
 * Trust Score and standing must be "stated as a prediction, never a promise"
 * because they move when other members verify themselves. A bar that gates on rank
 * breaks that structurally, not just in its wording.
 *
 * So rank lives on HER side, ordering her inbox (see her-inbox.ts). She still
 * effectively picks a top three — she just does it by looking, rather than by us
 * closing eleven doors.
 *
 * MONOTONIC. It never falls because of anything he didn't do. A bar that drops
 * mid-conversation turns Bestie's questions into a visible exam, which the spec's
 * "never an interrogation" rule forbids, and it tells him he is losing to someone
 * he cannot see. A refusal STALLS the bar with a named reason; only a proof that
 * fails verification or a claim he retracts may lower it.
 *
 * NEVER FEEDS TRUST OR MATCH SCORING. It is computed FROM w/v/c, so feeding it
 * back would close a loop — trust → c → bar → trust — and scores would drift with
 * no new evidence entering the system. It is also model-judged in part, and the
 * doc's "stated plainly" promise only holds for numbers resting on verified
 * evidence. Conversational/UX state only, exactly like the checklist.
 *
 * PURE. No database, no clock. Persistence and context assembly live elsewhere.
 */

import { MONEY_DIMENSION_IDS, type DimensionId } from '$lib/verified-vibe/dimensions';
import { PROVABLE_DIMS, DIM_TO_PROOF, ASK_PHRASE, CATEGORY_ASK_PHRASE, PROVEN_C, CLAIMING_V, MIN_WEIGHT } from './dimension-proof-map';
import { isDocumentProofCategory } from './proof-signals';
import type { Vec } from './vector-scoring';

/** Stage weights. Sum to 100. */
export const STAGE_WEIGHTS = { fit: 10, portfolio: 30, standout: 30, corroboration: 30 } as const;

/** The hand-off opens here. Soft: it surfaces him to her, it does not withhold him. */
export const HANDOFF_THRESHOLD = 90;

/**
 * Minimum notional slots per stage, expressed as "no stage may award more than this
 * for a single item". Its job is REACHABILITY, not display: without it a man with one
 * stated claim would find that claim worth the whole 30-point corroboration stage, so
 * one refusal — and refusals run near half of all asks — could put 90 out of reach.
 *
 * Note it does NOT cap what a single proof is worth overall, and must not: proving one
 * dimension legitimately moves three stages at once (portfolio, standout and
 * corroboration all improve), so a good upload really can be worth 25 points. Clamping
 * the figure he is SHOWN to 12 while handing him 25 would just make the number a lie.
 * The guarantee we actually owe him is that no single refusal closes the door, and that
 * is asserted directly in the tests rather than approximated by a cap.
 */
export const MAX_PER_STAGE_ITEM = 12;

/** How many independent routes to 90 we promise to keep open at all times. */
export const MIN_ROUTES = 2;

/** Her top-N weighted dimensions that stage 3 targets. */
export const STANDOUT_TARGETS = 3;

export interface GapBarStage {
	id: 'fit' | 'portfolio' | 'standout' | 'corroboration';
	label: string;
	weight: number;
	/** Points earned, 0..weight. */
	earned: number;
	complete: boolean;
	/** One line for the expanded card. Never names her weights in rank order. */
	detail: string;
}

export interface GapBarAction {
	dim: DimensionId;
	/** Proof category to invite (proof-signals taxonomy). */
	category: string;
	/** Friendly noun for the ask — "fitness", not the raw dimension id. */
	phrase: string;
	/**
	 * Percentage points this would actually add — the true figure, not a capped one.
	 * Derived by re-running the real calculation with the dimension proven, so what he
	 * is told and what he receives cannot drift apart.
	 */
	worth: number;
}

export interface GapBar {
	percent: number;
	stages: GapBarStage[];
	/** Highest-value thing left to do, or null when nothing would earn anything. */
	nextAction: GapBarAction | null;
	/** Other live routes to 90, so a refusal never looks like a dead end. */
	alternatives: GapBarAction[];
	/** True once he is at or past the threshold. */
	handoffReady: boolean;
	/** Stalled: something she values is unproven and every route to it was refused. */
	held: boolean;
	heldPhrase: string | null;
	/** Set when stage 1 failed outright — the match is not a fit and should close. */
	fitFailed: boolean;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round = (n: number) => Math.round(n * 10) / 10;

/**
 * Points per item for a stage, with the per-category cap applied by flooring the
 * denominator. A 30-point stage over 1 item would otherwise make that item worth
 * 30; ceil(30/12) = 3 forces at least three notional slots, so no item exceeds 10.
 */
function slotsFor(weight: number, count: number): number {
	return Math.max(count, Math.ceil(weight / MAX_PER_STAGE_ITEM));
}

/** Is this dimension proven to the point where a further proof earns nothing? */
const isProven = (conf: Vec, d: DimensionId) => (conf[d] ?? 0) >= PROVEN_C;

/** Her provable dimensions, most-valued first, money excluded. */
function herTargets(herWeights: Vec): DimensionId[] {
	return PROVABLE_DIMS
		.filter((d) => !(MONEY_DIMENSION_IDS as readonly string[]).includes(d))
		.filter((d) => (herWeights[d] ?? 0) >= MIN_WEIGHT)
		.sort((a, b) => (herWeights[b] ?? 0) - (herWeights[a] ?? 0));
}

/**
 * The proof category to invite for a dimension, or null when nothing is left to ask.
 * Document categories are skipped because the in-chat surface takes pictures only.
 */
function askableCategory(d: DimensionId, verified: Set<string>, refused: Set<string>): string | null {
	const cats = DIM_TO_PROOF[d] ?? [];
	// Skip the categories he ACTUALLY declined, not every category in the dimension.
	//
	// The old rule took out the whole dimension on one refusal, for a real reason:
	// every category shared a single per-dimension ask phrase, so falling through to a
	// sibling re-sent a word-for-word identical sentence — which is how one man got
	// asked for his income four times in six minutes. Now each category has its own
	// wording, so a fallthrough asks a genuinely different question and the blunt rule
	// costs more than it protects. It was collapsing a third of matches to no
	// alternative route at all, because `linkedin` sits in two dimensions and refusing
	// it killed both.
	return cats.find((c) => !verified.has(c) && !refused.has(c) && !isDocumentProofCategory(c)) ?? null;
}

export interface GapBarInput {
	/** Her preference weights. Null → stages 3 falls back to his own portfolio. */
	herWeights: Vec | null;
	hisAttrs: Vec | null;
	hisConf: Vec | null;
	/** Proof categories he has verified (his profile, so these carry across matches). */
	verifiedCategories: string[];
	/** Categories he declined. These STALL the bar; they never subtract from it. */
	refusedCategories?: string[];
	/**
	 * Stage 1: do the basics line up — intent, age, city, her hard nos. Judged from
	 * what he SAYS, so it is worth only 10. `false` means a hard mismatch, which is
	 * not a low score but a different outcome: the match should close rather than
	 * leave him capped at 10 with no explanation.
	 */
	fitPass: boolean;
	/**
	 * The last value shown to him. The bar is monotonic on his own actions, so this
	 * acts as a floor — a re-vet against her CHANGED weights can legitimately move
	 * stage 3's targets, and he must not watch his number fall for it.
	 */
	previousPercent?: number | null;
	/**
	 * Permission to go below the floor. The only two events that earn it: a proof
	 * that FAILED verification, and a claim he retracted. Both are things he did.
	 */
	allowDecrease?: boolean;
}

/**
 * @param skipActions internal. The "what would this be worth" figures are produced by
 * re-running this very function with one dimension proven, so that pass must not
 * compute its own action list or the recursion never bottoms out.
 */
export function computeGapBar(input: GapBarInput, skipActions = false): GapBar {
	const { herWeights, hisAttrs, hisConf, fitPass } = input;
	const verified = new Set(input.verifiedCategories ?? []);
	const refused = new Set(input.refusedCategories ?? []);

	// No vectors → nothing to score. Report an honest zero rather than a made-up
	// number; the caller shows the old counter instead.
	if (!hisAttrs || !hisConf) {
		return {
			percent: 0, stages: [], nextAction: null, alternatives: [],
			handoffReady: false, held: false, heldPhrase: null, fitFailed: !fitPass,
		};
	}

	// ── Stage 1 · Fit. Pass or fail, nothing in between.
	const fit: GapBarStage = {
		id: 'fit', label: 'Basics line up', weight: STAGE_WEIGHTS.fit,
		earned: fitPass ? STAGE_WEIGHTS.fit : 0, complete: fitPass,
		detail: fitPass
			? 'Intent, age and city work, and none of her hard nos apply.'
			: 'Something core does not line up.',
	};

	// ── Stage 2 · Portfolio. HIS profile, identical for every woman he talks to —
	// how much of what can be proven, is. Money counts here: as an anti-fraud proof
	// like any other, never as a reason anyone should want him.
	const portfolioDims = PROVABLE_DIMS;
	const portfolioProven = portfolioDims.filter((d) => isProven(hisConf, d));
	const portfolioSlots = slotsFor(STAGE_WEIGHTS.portfolio, portfolioDims.length);
	const portfolio: GapBarStage = {
		id: 'portfolio', label: 'Your profile holds up', weight: STAGE_WEIGHTS.portfolio,
		earned: round(clamp((portfolioProven.length / portfolioSlots) * STAGE_WEIGHTS.portfolio, 0, STAGE_WEIGHTS.portfolio)),
		complete: portfolioProven.length >= portfolioDims.length,
		detail: `${portfolioProven.length} of ${portfolioDims.length} sections have something real behind them.`,
	};

	// ── Stage 3 · Standout. Her top few weighted dimensions, scored against a FIXED
	// bar rather than against rivals. Her weights choose the targets; they never
	// decide the score. Money is excluded from being a target at all — financial
	// proof is a fraud check, not an attraction signal.
	const targets = herWeights ? herTargets(herWeights).slice(0, STANDOUT_TARGETS) : [];
	const targetsProven = targets.filter((d) => isProven(hisConf, d));
	// When she has no distilled weights yet, this stage cannot be judged. Award it in
	// proportion to his own portfolio rather than holding him at zero for her missing data.
	const standoutEarned = targets.length === 0
		? portfolio.earned * (STAGE_WEIGHTS.standout / STAGE_WEIGHTS.portfolio)
		: (targetsProven.length / slotsFor(STAGE_WEIGHTS.standout, targets.length)) * STAGE_WEIGHTS.standout;
	const standout: GapBarStage = {
		id: 'standout', label: 'What sets you apart', weight: STAGE_WEIGHTS.standout,
		earned: round(clamp(standoutEarned, 0, STAGE_WEIGHTS.standout)),
		complete: targets.length > 0 && targetsProven.length >= targets.length,
		detail: targets.length === 0
			? 'Judged on your own profile until she has told us more about what she wants.'
			: `${targetsProven.length} of ${targets.length} things she cares most about are proven.`,
	};

	// ── Stage 4 · Corroboration. Of the things he has actually CLAIMED, how many
	// stand up. Claiming nothing is not penalised here; stage 2 already covers
	// coverage. This stage is specifically about talk matching evidence.
	const claimed = PROVABLE_DIMS.filter((d) => (hisAttrs[d] ?? 0) >= CLAIMING_V);
	const backed = claimed.filter((d) => isProven(hisConf, d));
	const corroborationEarned = claimed.length === 0
		? STAGE_WEIGHTS.corroboration // nothing claimed → nothing outstanding
		: (backed.length / slotsFor(STAGE_WEIGHTS.corroboration, claimed.length)) * STAGE_WEIGHTS.corroboration;
	const corroboration: GapBarStage = {
		id: 'corroboration', label: 'Backing up your claims', weight: STAGE_WEIGHTS.corroboration,
		earned: round(clamp(corroborationEarned, 0, STAGE_WEIGHTS.corroboration)),
		complete: claimed.length === 0 || backed.length >= claimed.length,
		detail: claimed.length === 0
			? 'Nothing outstanding — you have not claimed anything that needs evidence.'
			: `${claimed.length - backed.length} thing(s) you have said still rest on your word alone.`,
	};

	const stages = [fit, portfolio, standout, corroboration];
	const raw = stages.reduce((s, x) => s + x.earned, 0);

	// ── What to do next. Ranked by what it would actually add, then by how much SHE
	// weights it — so the recommendation is the highest-leverage real gap, not the
	// cheapest one. Uploads that would earn nothing are not offered at all.
	const candidates: GapBarAction[] = [];
	for (const d of skipActions ? [] : PROVABLE_DIMS) {
		if (isProven(hisConf, d)) continue;                 // already shown
		if ((MONEY_DIMENSION_IDS as readonly string[]).includes(d)) continue; // never an attraction ask
		const category = askableCategory(d, verified, refused);
		if (!category) continue;                            // verified, refused, or doc-only
		// The TRUE gain, not a clamped one. This number is shown to him, so it has to be
		// what he actually receives — see MAX_PER_STAGE_ITEM.
		const worth = round(gainFrom(d, input, raw));
		if (worth <= 0) continue;                           // earns nothing → don't ask
		candidates.push({
			dim: d, category, worth,
			// The CATEGORY's wording, not the dimension's. Thirteen possible asks instead
			// of four, so "your next step" stops being one of four sentences he hears in
			// every conversation he has.
			phrase: CATEGORY_ASK_PHRASE[category] ?? ASK_PHRASE[d] ?? d.replace(/_/g, ' '),
		});
	}
	candidates.sort((a, b) => b.worth - a.worth || (herWeights?.[b.dim] ?? 0) - (herWeights?.[a.dim] ?? 0));

	// ── Held. Everything she values is either proven or was refused, and he is short
	// of the threshold. The bar stalls here; it does not fall, and the reason is named
	// so a boundary never reads as a failing.
	const shortOfThreshold = raw < HANDOFF_THRESHOLD;
	const held = shortOfThreshold && candidates.length === 0;
	const heldDim = held
		? herTargets(herWeights ?? {}).find((d) => !isProven(hisConf, d)) ?? null
		: null;

	const floor = input.allowDecrease ? 0 : (input.previousPercent ?? 0);
	const percent = round(clamp(Math.max(raw, floor), 0, 100));

	return {
		percent,
		stages,
		nextAction: candidates[0] ?? null,
		alternatives: candidates.slice(1, 1 + MIN_ROUTES),
		handoffReady: percent >= HANDOFF_THRESHOLD,
		held,
		heldPhrase: heldDim ? (ASK_PHRASE[heldDim] ?? heldDim) : null,
		fitFailed: !fitPass,
	};
}

/**
 * What proving one dimension would add, by recomputing the bar with that dimension
 * confident and taking the difference. Doing it by re-running the real calculation
 * rather than by a formula means the figure he is shown can never drift from what
 * he actually gets — which matters, because we put that number in front of him.
 */
function gainFrom(d: DimensionId, input: GapBarInput, currentRaw: number): number {
	const hypothetical = computeGapBar(
		{
			...input,
			hisConf: { ...(input.hisConf ?? {}), [d]: 1 },
			// No floor — we want the raw effect of the proof, not the monotonic view.
			previousPercent: null,
			allowDecrease: true,
		},
		true // skipActions: stops this bottoming out in infinite recursion
	);
	const rawAfter = hypothetical.stages.reduce((s, x) => s + x.earned, 0);
	return rawAfter - currentRaw;
}
