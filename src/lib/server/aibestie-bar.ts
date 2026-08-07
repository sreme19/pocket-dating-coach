/**
 * aibestie-bar.ts — the landing page's progress bar.
 *
 * WHY THIS IS NOT THE REAL GAP BAR. computeGapBar scores from proofs and vectors
 * only. A visitor who has uploaded nothing scores fit 10 + portfolio 0 + standout
 * 0 + corroboration 30 (nothing claimed means nothing outstanding) — 40%, and it
 * cannot move, because the only lever is an upload he will not make on a landing
 * page. A bar that renders at 40 and then sits still for the whole conversation
 * is worse than no bar: it is a progress indicator that visibly does not track
 * progress.
 *
 * So the LP bar measures the CHECKLIST — the questions her Bestie is actually
 * working through — which genuinely advances as he answers. It wears the real
 * bar's four-segment clothing so the page matches the app, but it is a different
 * number and it is capped low on purpose.
 *
 * THE CAP IS WHAT KEEPS THE APP BAR FROM FALLING. He sees a number here, then
 * installs and sees the real one. The real bar is monotonic by design — it never
 * drops for anything he did not do — so an LP number above what the app computes
 * would break that promise the moment he arrives. 20 sits below the 40 a
 * claim-free man scores, so the transition is always upward.
 *
 * That only holds while nothing writes claims into his vectors during the
 * conversation. It is why captureMaleChatIntel must NOT run per-message on this
 * surface: five turns of him talking about himself would populate `attributes`,
 * drop corroboration to 0, and make the app compute 10 — below the 20 he was
 * shown. Intel capture runs once at signup instead, after the LP value has been
 * written into verified_vibe_matches.gap_bar_percent, where persistGapBar's lte
 * guard turns it into a permanent floor.
 *
 * PURE. No database, no clock.
 */

import type { BestieChecklist } from './bestie-checklist';
import { doneCount, totalCount } from './bestie-checklist';

/** The ceiling. See the module comment — this number is load-bearing. */
export const LP_BAR_MAX = 20;

/** Points for a checklist item her Bestie has marked genuinely answered. */
export const POINTS_PER_ITEM = 4;

/**
 * Points for a turn in which he said something substantive.
 *
 * Items alone are too coarse to feel like progress: the checklist holds 2–5 of
 * them (CHECKLIST_MIN/MAX_ITEMS) across a 5-turn conversation, so the bar would
 * move in at most a handful of jumps — and buildChecklist returns null below two
 * items, which would leave it frozen at 0 for the entire visit. The per-turn
 * creep is what makes it move every time he replies. Deliberately small: items
 * carry the meaning, turns supply the motion.
 */
export const POINTS_PER_TURN = 1;

/**
 * A message short enough to be a shrug is not progress. Low bar on purpose — the
 * judgement of whether an answer really landed belongs to Bestie, who marks the
 * checklist item; this only filters "k" and "hi".
 */
export const SUBSTANTIVE_MIN_CHARS = 12;

export function isSubstantive(message: string): boolean {
	return message.trim().length >= SUBSTANTIVE_MIN_CHARS;
}

export interface LpBarStage {
	id: 'fit' | 'portfolio' | 'standout' | 'corroboration';
	label: string;
	weight: number;
	earned: number;
}

export interface LpBar {
	percent: number;
	stages: LpBarStage[];
	/** What moving it next depends on, phrased for him. Null when capped. */
	nextLabel: string | null;
	/** True once the cap is reached — the bar stops, the conversation need not. */
	capped: boolean;
}

/**
 * Segment weights, identical to the real bar (gap-bar.ts STAGE_WEIGHTS) so the
 * page is visually the same control. Fill is laid down left to right across them
 * rather than computed per stage: these stages describe proof coverage, which is
 * not what is being measured here, so pretending to score them individually would
 * put a false claim in the expanded card. The page's expanded state shows the
 * checklist framing instead.
 */
const STAGES: Array<{ id: LpBarStage['id']; label: string; weight: number }> = [
	{ id: 'fit', label: 'Basics line up', weight: 10 },
	{ id: 'portfolio', label: 'Your profile holds up', weight: 30 },
	{ id: 'standout', label: 'What sets you apart', weight: 30 },
	{ id: 'corroboration', label: 'Backing up your claims', weight: 30 }
];

export interface LpBarInput {
	checklist: BestieChecklist | null;
	/** His messages so far that cleared isSubstantive(). */
	substantiveTurns: number;
	/** The last value shown. Monotonic here too — he never watches it fall. */
	previousPercent?: number | null;
}

export function computeLpBar(input: LpBarInput): LpBar {
	const done = doneCount(input.checklist);
	const total = totalCount(input.checklist);

	const raw = done * POINTS_PER_ITEM + input.substantiveTurns * POINTS_PER_TURN;
	const floor = input.previousPercent ?? 0;
	const percent = Math.min(LP_BAR_MAX, Math.max(raw, floor));

	// Fill the segments left to right out of one budget, so the bar reads as a
	// single quantity rather than four independently scored ones.
	let remaining = percent;
	const stages: LpBarStage[] = STAGES.map((s) => {
		const earned = Math.max(0, Math.min(s.weight, remaining));
		remaining -= earned;
		return { ...s, earned: Math.round(earned * 10) / 10 };
	});

	const capped = percent >= LP_BAR_MAX;
	return {
		percent: Math.round(percent * 10) / 10,
		stages,
		nextLabel: capped
			? null
			: total > 0
				? `${done} of ${total} things she wanted to know`
				: 'Tell her a bit more',
		capped
	};
}
