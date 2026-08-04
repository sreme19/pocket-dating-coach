/**
 * gap-bar-service.ts — the gap bar for a real match.
 *
 * gap-bar.ts is pure and knows nothing about the database. This is the layer that
 * feeds it: her weights, his attributes and confidence, what he has verified, what
 * he declined, and the last value he was shown (the monotonic floor).
 *
 * The stored percentage exists ONLY to make the bar monotonic. It is display state,
 * exactly like the checklist and the proof request, and it must never be read back
 * into trust or match scoring — the bar is computed FROM those vectors, so feeding
 * it back would close a loop and let scores drift with no new evidence.
 */

import { computeGapBar, type GapBar, type GapBarInput } from './gap-bar';
import { loadProofSignals, refusedCategories, type ProofRequestState } from './proof-signals';
import { resolveProxyPair } from './bestie-pair';
import { normalizeMode } from './networking-season';
import type { Vec } from './vector-scoring';

export interface MatchGapBar {
	bar: GapBar;
	womanId: string;
	manId: string;
	/** True when the stored value should be updated (it moved). */
	changed: boolean;
}

/**
 * Compute the bar for a match, or null when the match has no bar at all.
 *
 * Null cases are deliberate, not failures:
 *  · a same-gender pair — Bestie does not speak there, so there is nothing to score
 *  · a match that does not exist
 */
export async function loadMatchGapBar(
	supabase: any,
	matchId: string
): Promise<MatchGapBar | null> {
	const pair = await resolveProxyPair(supabase, matchId);
	if (!pair) return null;

	const { data: matchRow } = await supabase
		.from('verified_vibe_matches')
		.select('proof_request, gap_bar_percent')
		.eq('id', matchId)
		.maybeSingle();

	const [herVec, hisVec, proofSignals] = await Promise.all([
		supabase.from('vv_user_vectors').select('weights').eq('user_id', pair.woman.id).maybeSingle().then((r: any) => r.data),
		supabase.from('vv_user_vectors').select('attributes, confidence').eq('user_id', pair.man.id).maybeSingle().then((r: any) => r.data),
		loadProofSignals(supabase, pair.man.id),
	]);

	const proofState = (matchRow?.proof_request ?? null) as ProofRequestState | null;
	// Missing column (deploy-before-migrate) reads as undefined, which becomes no
	// floor — the bar still works, it just is not monotonic until the migration runs.
	const previousPercent = typeof matchRow?.gap_bar_percent === 'number' ? matchRow.gap_bar_percent : null;

	const input: GapBarInput = {
		herWeights: (herVec?.weights ?? null) as Vec | null,
		hisAttrs: (hisVec?.attributes ?? null) as Vec | null,
		hisConf: (hisVec?.confidence ?? null) as Vec | null,
		verifiedCategories: proofSignals.categories,
		refusedCategories: refusedCategories(proofState),
		// Stage 1 passes because the match EXISTS: the matchmaker applies her hard
		// filters (age, city, intent, hard nos) before creating one, so a match on the
		// board has already cleared them. A hard-no discovered later in conversation is
		// a separate outcome — the match closes — rather than a lower score, so it is
		// not modelled as a failing fit here.
		fitPass: true,
		previousPercent,
	};

	const bar = computeGapBar(input);
	return {
		bar,
		womanId: pair.woman.id,
		manId: pair.man.id,
		changed: previousPercent === null || Math.abs(bar.percent - previousPercent) > 0.05,
	};
}

/**
 * Store the percentage so the next computation has a floor.
 *
 * Non-fatal and guarded on the value only rising, so two concurrent turns cannot
 * hand the man a lower number than he has already seen. `allowDecrease` is the
 * escape hatch for the two events that earn one: a proof that failed verification,
 * and a claim he retracted.
 */
export async function persistGapBar(
	supabase: any,
	matchId: string,
	percent: number,
	opts: { allowDecrease?: boolean } = {}
): Promise<void> {
	try {
		const q = supabase.from('verified_vibe_matches').update({ gap_bar_percent: percent }).eq('id', matchId);
		// lte guard = monotonic at the database, so it holds even if two turns race.
		await (opts.allowDecrease ? q : q.or(`gap_bar_percent.is.null,gap_bar_percent.lte.${percent}`));
	} catch (e) {
		console.warn('[gap-bar] persist failed (non-fatal):', e);
	}
}

/**
 * Should this thread show a bar at all?
 *
 * Networking Season keeps the bar but makes it PASSIVE: it accrues from proofs and
 * whatever he volunteers, while Bestie stops driving toward it with dating-framed
 * questions. A networking contact who later flips to Date then arrives already
 * vetted instead of starting cold. Same-gender pairs have no bar, which is handled
 * upstream by resolveProxyPair returning null.
 */
export function gapBarMode(
	ownerMode: unknown,
	partnerMode: unknown
): 'active' | 'passive' {
	const networking =
		normalizeMode(ownerMode) === 'networking' || normalizeMode(partnerMode) === 'networking';
	return networking ? 'passive' : 'active';
}
