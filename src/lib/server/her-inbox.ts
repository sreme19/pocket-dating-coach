/**
 * her-inbox.ts — her suitors, ranked.
 *
 * This is where competition belongs. The man's bar is absolute so that every man who
 * does the work can reach the threshold; ranking one man against another is her
 * business, and it happens here.
 *
 * WHY THIS EXISTS AT ALL. Of the Bestie hand-offs that completed, 33 wrapped and 22
 * expired unanswered — two thirds of successfully-vetted men were lost because the
 * woman never replied, and every single expiry was a thread Bestie had finished
 * doing its job on. The median woman has 14 suitors and no view that orders them.
 * She is not ignoring men she has judged; she is looking at an undifferentiated list.
 *
 * RANKED BY APPEAL, NOT BY THE BAR. A(m→f) = Σ w[f,d]·v[m,d]·c[m,d] — how much of
 * what SHE weights he has actually proven. A man at 61% of his bar can outrank a man
 * at 88% when what he has proven is what she cares about most, and that is correct:
 * the bar measures completeness against a fixed target, appeal measures fit to her.
 * Ordering by the bar would just show her the most thorough uploader.
 *
 * COMPUTED ON DEMAND. The nightly competitive snapshot is up to 24 hours stale, so
 * ordering from it would reshuffle her list for reasons she cannot see. Rival appeals
 * are cheap — one vector read across her own matches, no pool-wide access — so this
 * stays inside the data-access boundary that reserves whole-pool reads for the
 * Matchmaker.
 *
 * SHE NEVER SEES HIS PERCENTAGE. She sees rank and what is unproven. His number is
 * his.
 */

import { appeal, standingRank, type Vec } from './vector-scoring';
import { PROVABLE_DIMS, ASK_PHRASE, PROVEN_C, MIN_WEIGHT } from './dimension-proof-map';
import { MONEY_DIMENSION_IDS } from '$lib/verified-vibe/dimensions';
import { HANDOFF_THRESHOLD } from './gap-bar';

/** Always show her at least this many, even if fewer have cleared the threshold. */
export const MIN_SURFACED = 3;

export interface RankedSuitor {
	matchId: string;
	manId: string;
	firstName: string;
	/** 1 = strongest fit to her stated preferences. */
	rank: number;
	/** Appeal toward her, 0–100. Internal ordering value — not shown to her as a score. */
	appeal: number;
	/**
	 * Whether Bestie has finished vetting him AND he cleared the bar. Drives which
	 * section he appears in.
	 */
	ready: boolean;
	/**
	 * Short, neutral note on what is still unproven — "income unproven", "portfolio
	 * thin". Never a warning and never a judgement: a man who declined to share bank
	 * statements made a reasonable choice, and this line must not read as a failing.
	 */
	unprovenNote: string | null;
	/** He stopped answering a question round. Sinks him, reversibly. */
	waitingOnHim: boolean;
}

export interface HerInbox {
	/** Cleared the threshold — the ones she is asked to look at. */
	ready: RankedSuitor[];
	/** Still being vetted, or short of the threshold. Ordered the same way. */
	vetting: RankedSuitor[];
	/** Sunk: he owes her an answer. */
	waiting: RankedSuitor[];
	totalSuitors: number;
}

export interface SuitorInput {
	matchId: string;
	manId: string;
	firstName: string;
	attrs: Vec | null;
	conf: Vec | null;
	/** His gap-bar percentage, if computed. Used ONLY to decide readiness, never to order. */
	gapBarPercent: number | null;
	/** Bestie wrapped her checklist on him. */
	wrapped: boolean;
	waitingOnHim: boolean;
	/**
	 * A hard mismatch Bestie found in his own words (G-2). Takes over the note, because
	 * "he says he isn't looking for a relationship" matters more to her than which proof
	 * is outstanding. It never removes him from her list: the decision is hers.
	 */
	fitMismatch?: string | null;
}

/**
 * Build her ranked inbox.
 *
 * Pure, so the ordering rule is testable without a database and cannot quietly
 * acquire a dependency on the nightly snapshot.
 */
export function buildHerInbox(herWeights: Vec | null, suitors: SuitorInput[]): HerInbox {
	// No distilled preferences yet → we cannot rank by fit. Fall back to the order we
	// were given rather than inventing one; a fabricated ranking is worse than none.
	const scored = suitors.map((s) => ({
		s,
		appeal: herWeights && s.attrs && s.conf ? appeal(herWeights, s.attrs, s.conf) : 0,
	}));

	const allAppeals = scored.map((x) => x.appeal);
	const rows: RankedSuitor[] = scored
		.slice()
		.sort((a, b) => b.appeal - a.appeal)
		.map((x) => ({
			matchId: x.s.matchId,
			manId: x.s.manId,
			firstName: x.s.firstName,
			rank: standingRank(x.appeal, allAppeals.filter((a) => a !== x.appeal)).rank,
			appeal: Math.round(x.appeal * 10) / 10,
			ready: x.s.wrapped && (x.s.gapBarPercent ?? 0) >= HANDOFF_THRESHOLD,
			// A hard mismatch takes over the note: "he says he isn't looking for a
			// relationship" matters more to her than which proof is outstanding. He stays
			// in her list either way — the decision is hers, not Bestie's.
			unprovenNote: x.s.fitMismatch?.trim() || unprovenNote(herWeights, x.s.conf),
			waitingOnHim: x.s.waitingOnHim,
		}));

	// Re-rank cleanly by position, so ties read as 1,2,3 rather than sharing a number.
	rows.forEach((r, i) => (r.rank = i + 1));

	const waiting = rows.filter((r) => r.waitingOnHim);
	const rest = rows.filter((r) => !r.waitingOnHim);
	let ready = rest.filter((r) => r.ready);
	let vetting = rest.filter((r) => !r.ready);

	// TOP UP to MIN_SURFACED. The threshold is SOFT: it promotes a man into her
	// attention, it does not withhold anyone from her. If fewer than three have
	// cleared it she is still shown three — the next strongest by fit, flagged with
	// what is unproven — because an empty "ready for you" section is how she learns
	// there is nothing here for her and stops opening the tab. She can always reach
	// past the gate; that is the whole point of it being soft.
	if (ready.length < MIN_SURFACED && vetting.length > 0) {
		const topUp = vetting.slice(0, MIN_SURFACED - ready.length);
		ready = [...ready, ...topUp];
		vetting = vetting.slice(topUp.length);
	}

	return { ready, vetting, waiting, totalSuitors: rows.length };
}

/**
 * One neutral line on what he has not backed up, chosen from what SHE weights.
 *
 * Money is named plainly when she weights it — she is entitled to know a claim is
 * unproven — but it is never framed as making him more or less desirable, and it is
 * never something Bestie chases him for.
 */
function unprovenNote(herWeights: Vec | null, conf: Vec | null): string | null {
	if (!conf) return 'nothing verified yet';
	const weights = herWeights ?? {};
	// PROVABLE_DIMS is "what Bestie may ASK him for", and money was deliberately taken
	// out of it — she never chases him for income and it is never an attraction target.
	// What SHE may be TOLD is a different set: money can be proven (by document, off
	// this surface), so if she weights it and he has not, that is a fact she is entitled
	// to. Naming it is not the same as pursuing it.
	const reportable = [...PROVABLE_DIMS, ...MONEY_DIMENSION_IDS];
	const unproven = reportable
		.filter((d) => (conf[d] ?? 0) < PROVEN_C)
		.filter((d) => (weights[d] ?? 0) >= MIN_WEIGHT || Object.keys(weights).length === 0)
		.sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0));

	if (unproven.length === 0) return null;
	if (unproven.length >= 3) return 'portfolio thin';
	const d = unproven[0];
	const phrase = (MONEY_DIMENSION_IDS as readonly string[]).includes(d)
		? 'income'
		: ASK_PHRASE[d] ?? d.replace(/_/g, ' ');
	return `${phrase} unproven`;
}
