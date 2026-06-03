/**
 * Match-intelligence context (Phase 3/4) — the SYNCHRONOUS read side of the
 * Matchmaker's match-scoring layer.
 *
 * The heavy LLM scoring (match-scoring.ts) runs in batch/triggers and writes
 * vv_match_scores. Here we read those precomputed rows for the current user:
 *   - loadMatchIntelligence()        → structured data (for the "Where you stand"
 *                                       UI panel via the GET endpoint)
 *   - loadMatchIntelligenceContext() → formatted prompt block (for Wingman/Bestie
 *                                       to ground "how do I improve" replies)
 * Both are fast (no Claude), so the agent/UI never wait on an async report — the
 * fix for the old "report lands a turn late" RCA. Works for either gender.
 */

export interface MatchIntelSimAction {
	action: string;
	label: string;
	trustBefore: number;
	trustAfter: number;
	standingBefore: number | null;
	standingAfter: number | null;
	standingPool: number | null;
	deterministic: boolean;
	note?: string;
}

export interface MatchIntel {
	partnerId: string;
	partnerName: string;
	direction: 'toHer' | 'toHim';
	appeal: number | null;
	standingRank: number | null;
	standingPool: number | null;
	checklist: string[];
	simulation: MatchIntelSimAction[];
}

/** Structured per-match intelligence for the requesting user's own side. */
export async function loadMatchIntelligence(
	supabase: unknown,
	userId: string
): Promise<MatchIntel[]> {
	try {
		const db = supabase as any;
		const { data: u } = await db
			.from('verified_vibe_users')
			.select('gender')
			.eq('id', userId)
			.maybeSingle();
		if (!u) return [];
		const isMan = u.gender === 'man';

		const { data: rows } = await db
			.from('vv_match_scores')
			.select('*')
			.eq(isMan ? 'male_user_id' : 'female_user_id', userId);
		if (!rows?.length) return [];

		const out: MatchIntel[] = [];
		for (const r of rows) {
			const partnerId = isMan ? r.female_user_id : r.male_user_id;
			const { data: p } = await db
				.from('verified_vibe_users')
				.select('first_name')
				.eq('id', partnerId)
				.maybeSingle();
			out.push({
				partnerId,
				partnerName: p?.first_name ?? 'this match',
				direction: isMan ? 'toHer' : 'toHim',
				appeal: isMan ? r.appeal_to_her : r.appeal_to_him,
				standingRank: isMan ? r.his_standing_rank : r.her_standing_rank,
				standingPool: isMan ? r.his_standing_pool : r.her_standing_pool,
				checklist: (isMan ? r.his_checklist : r.her_checklist) ?? [],
				simulation: (isMan ? r.his_simulation : r.her_simulation) ?? [],
			});
		}
		return out;
	} catch (e) {
		console.warn('loadMatchIntelligence failed (non-fatal):', e);
		return [];
	}
}

/** Formatted prompt block for the Wingman/Bestie system prompt. */
export async function loadMatchIntelligenceContext(
	supabase: unknown,
	userId: string
): Promise<string> {
	const intel = await loadMatchIntelligence(supabase, userId);
	if (!intel.length) return '';

	const blocks: string[] = [];
	for (const m of intel) {
		const her = m.direction === 'toHer';
		const subj = her ? 'he is' : 'she is';
		const lines: string[] = [];
		lines.push(`**${m.partnerName}** — Appeal-to-${her ? 'Her' : 'Him'}: ${m.appeal ?? 'n/a'}/100.`);
		if (typeof m.standingRank === 'number' && typeof m.standingPool === 'number') {
			lines.push(
				m.standingPool <= 1
					? `Standing: ${subj} ${m.partnerName}'s ONLY mutual match — no competition, the job is to convert, not out-rank.`
					: `Standing with ${m.partnerName}: #${m.standingRank} of ${m.standingPool} mutual matches.`
			);
		}
		if (m.checklist.length) {
			lines.push(`Ways to raise appeal with ${m.partnerName} (approach advice — never quote her preferences back):`);
			m.checklist.forEach((c) => lines.push(`  - ${c}`));
		}
		if (m.simulation.length) {
			lines.push(`Predicted effect of concrete actions (these trust/standing numbers are EXACT — state them plainly):`);
			for (const a of m.simulation) {
				const standing = (a.standingBefore != null && a.standingAfter != null && (a.standingPool ?? 0) > 1)
					? `, standing #${a.standingBefore}→#${a.standingAfter} of ${a.standingPool}`
					: '';
				const tag = a.deterministic ? '' : ' (estimate)';
				lines.push(`  - ${a.label}: trust ${a.trustBefore}→${a.trustAfter}${standing}${tag}${a.note ? ` — ${a.note}` : ''}`);
			}
		}
		blocks.push(lines.join('\n'));
	}

	return (
		`\n\nMATCH INTELLIGENCE (precomputed by the Matchmaker — Standing, appeal, and the EXACT predicted effect of each action; this is the source of truth for "how do I improve / move up"):\n` +
		blocks.join('\n\n') +
		`\n\nRULES for using match intelligence:\n` +
		`- The trust/percentile/standing deltas above are computed, not guessed — state them as concrete facts ("upload a fitness shot → your trust goes 86→90"). Items marked "(estimate)" are not guaranteed — hedge those.\n` +
		`- If a "Verify your ID + selfie" action appears, lead with it — identity is unverified and is heavily penalising the score until done.\n` +
		`- If standing is already #1 / the only match, don't manufacture competition — pivot to converting the match and to staying ahead.\n` +
		`- Turn the checklist into warm, specific coaching; never read her private preferences back to him.`
	);
}
