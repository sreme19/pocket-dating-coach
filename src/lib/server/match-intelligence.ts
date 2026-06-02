/**
 * Match-intelligence context (Phase 3) — the SYNCHRONOUS read side of the
 * Matchmaker's match-scoring layer.
 *
 * The heavy LLM scoring (match-scoring.ts) runs in batch/triggers and writes
 * vv_match_scores. Here the Wingman/Bestie read those precomputed rows for the
 * current user and format them into a prompt block — fast, no Claude — so the
 * agent grounds THIS reply in real Standing + the predictive what-if simulator,
 * instead of firing an async report that lands a turn too late (the old RCA).
 *
 * Works for either gender (Wingman reads the man's side, Bestie the woman's).
 */

export async function loadMatchIntelligenceContext(
	supabase: unknown,
	userId: string
): Promise<string> {
	try {
		const db = supabase as any;

		const { data: u } = await db
			.from('verified_vibe_users')
			.select('gender')
			.eq('id', userId)
			.maybeSingle();
		if (!u) return '';
		const isMan = u.gender === 'man';

		const { data: rows } = await db
			.from('vv_match_scores')
			.select('*')
			.eq(isMan ? 'male_user_id' : 'female_user_id', userId);
		if (!rows?.length) return '';

		const blocks: string[] = [];
		for (const r of rows) {
			const partnerId = isMan ? r.female_user_id : r.male_user_id;
			const { data: p } = await db
				.from('verified_vibe_users')
				.select('first_name')
				.eq('id', partnerId)
				.maybeSingle();
			const name = p?.first_name ?? 'this match';

			const appeal = isMan ? r.appeal_to_her : r.appeal_to_him;
			const rank = isMan ? r.his_standing_rank : r.her_standing_rank;
			const pool = isMan ? r.his_standing_pool : r.her_standing_pool;
			const checklist: string[] = (isMan ? r.his_checklist : r.her_checklist) ?? [];
			const sim: any[] = (isMan ? r.his_simulation : r.her_simulation) ?? [];

			const subj = isMan ? 'he is' : 'she is';
			const lines: string[] = [];
			lines.push(`**${name}** — Appeal-to-${isMan ? 'Her' : 'Him'}: ${appeal ?? 'n/a'}/100.`);
			if (typeof rank === 'number' && typeof pool === 'number') {
				lines.push(
					pool <= 1
						? `Standing: ${subj} ${name}'s ONLY mutual match — no competition, the job is to convert, not out-rank.`
						: `Standing with ${name}: #${rank} of ${pool} mutual matches.`
				);
			}
			if (checklist.length) {
				lines.push(`Ways to raise appeal with ${name} (approach advice — never quote her preferences back):`);
				checklist.forEach((c) => lines.push(`  - ${c}`));
			}
			if (sim.length) {
				lines.push(`Predicted effect of concrete actions (these trust/standing numbers are EXACT — state them plainly):`);
				for (const a of sim) {
					const standing = (a.standingBefore != null && a.standingAfter != null && a.standingPool > 1)
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
	} catch (e) {
		console.warn('loadMatchIntelligenceContext failed (non-fatal):', e);
		return '';
	}
}
