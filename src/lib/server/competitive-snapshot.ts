/**
 * Competitive Intelligence Snapshot
 *
 * A LIGHTWEIGHT, synchronous competitive read computed inline before the AI
 * Wingman generates — distinct from the heavy, LLM-driven async report in
 * matchmaker-service.ts (generatePerMatchRanking), which lands a turn too late
 * to ground the reply (see RCA: report completes ~40s after the reply is sent).
 *
 * This snapshot is cheap SQL only — no Claude calls — so it can block the
 * request without adding meaningful latency. It answers the three questions the
 * Wingman keeps hallucinating answers to:
 *   a) how many REAL women are active on the platform right now
 *   b) how many REAL men are active (his actual competition pool)
 *   c) how many REAL men qualify to pursue each of HIS matches
 * Plus his normalized standing among real men (trust_score is otherwise an
 * absolute, population-blind number — see RCA point 1).
 *
 * "Real"   = is_seed = false (excludes seed/demo profiles).
 * "Active" = last_active_at within ACTIVE_WINDOW_DAYS.
 */

import { hardFilter, type WingmanPoolRow, type BestiePoolRow } from './matchmaker-service';

const ACTIVE_WINDOW_DAYS = 7;

export interface CompetitiveSnapshot {
	realWomenActive: number;
	realMenActive: number;
	trustRank: { score: number; rank: number; total: number; percentile: number } | null;
	matchRivals: Array<{ firstName: string; qualifiedRivals: number; filtered: boolean }>;
	/** Pre-formatted block ready to splice into the Wingman system prompt. */
	promptBlock: string;
}

/**
 * Compute the snapshot for a male user. Never throws — on any failure it returns
 * a zeroed snapshot with an empty promptBlock so the Wingman degrades to its
 * prior behaviour rather than erroring the chat.
 */
export async function buildCompetitiveSnapshot(
	supabase: unknown,
	userId: string
): Promise<CompetitiveSnapshot> {
	const empty: CompetitiveSnapshot = {
		realWomenActive: 0,
		realMenActive: 0,
		trustRank: null,
		matchRivals: [],
		promptBlock: '',
	};

	try {
		const db = supabase as any;
		const activeCutoff = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

		// ── (a)/(b) Active real population counts ────────────────────────────
		const [{ count: womenCount }, { count: menCount }] = await Promise.all([
			db.from('verified_vibe_users')
				.select('id', { count: 'exact', head: true })
				.eq('is_seed', false)
				.eq('gender', 'woman')
				.gte('last_active_at', activeCutoff),
			db.from('verified_vibe_users')
				.select('id', { count: 'exact', head: true })
				.eq('is_seed', false)
				.eq('gender', 'man')
				.gte('last_active_at', activeCutoff),
		]);

		// ── Normalized trust standing among ALL real men (RCA point 1) ───────
		// Absolute trust_score is population-blind; rank him against the real
		// male field so the Wingman stops pushing impossible point-grinding.
		const { data: realMen } = await db
			.from('verified_vibe_users')
			.select('id, trust_score')
			.eq('is_seed', false)
			.eq('gender', 'man');

		let trustRank: CompetitiveSnapshot['trustRank'] = null;
		if (Array.isArray(realMen) && realMen.length) {
			const me = realMen.find((m: any) => m.id === userId);
			if (me) {
				const myScore = me.trust_score ?? 0;
				const total = realMen.length;
				// Rank: 1 = highest. Ties share the better (lower) rank.
				const ahead = realMen.filter((m: any) => (m.trust_score ?? 0) > myScore).length;
				const rank = ahead + 1;
				// "top X%" — smaller is better. rank 1 of 3 → top 33%.
				const percentile = Math.max(1, Math.round((rank / total) * 100));
				trustRank = { score: myScore, rank, total, percentile };
			}
		}

		// ── (c) Qualified rivals per match (real active men who pass her filter) ──
		const { data: matches } = await db
			.from('verified_vibe_matches')
			.select('id, user1_id, user2_id, status')
			.or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
			.eq('status', 'mutual');

		const matchRivals: CompetitiveSnapshot['matchRivals'] = [];

		if (Array.isArray(matches) && matches.length) {
			// Real, active men other than the owner — the candidate rival set.
			const { data: rivalMen } = await db
				.from('verified_vibe_users')
				.select('id')
				.eq('is_seed', false)
				.eq('gender', 'man')
				.gte('last_active_at', activeCutoff)
				.neq('id', userId);
			const rivalIds: string[] = (rivalMen ?? []).map((r: any) => r.id);

			// Their distilled wingman pool rows (needed to run the production hard filter).
			let rivalPoolRows: WingmanPoolRow[] = [];
			if (rivalIds.length) {
				const { data: pool } = await db
					.from('vv_pool_wingmen')
					.select('*')
					.in('user_id', rivalIds);
				rivalPoolRows = (pool ?? []) as WingmanPoolRow[];
			}

			for (const match of matches as Array<{ user1_id: string; user2_id: string }>) {
				const femaleId = match.user1_id === userId ? match.user2_id : match.user1_id;
				const [{ data: femalePool }, { data: femaleUser }] = await Promise.all([
					db.from('vv_pool_besties').select('*').eq('user_id', femaleId).single(),
					db.from('verified_vibe_users').select('first_name').eq('id', femaleId).single(),
				]);
				const firstName = femaleUser?.first_name ?? 'your match';

				if (femalePool) {
					// Real active men whose pool row passes HER hard filters = genuine rivals.
					const qualified = rivalPoolRows.filter(
						(m) => !hardFilter(m, femalePool as BestiePoolRow, false)
					).length;
					matchRivals.push({ firstName, qualifiedRivals: qualified, filtered: true });
				} else {
					// No distilled profile to filter against — report the raw real-active
					// male field and flag that it isn't preference-filtered.
					matchRivals.push({ firstName, qualifiedRivals: rivalIds.length, filtered: false });
				}
			}
		}

		const snapshot: CompetitiveSnapshot = {
			realWomenActive: womenCount ?? 0,
			realMenActive: menCount ?? 0,
			trustRank,
			matchRivals,
			promptBlock: '',
		};
		snapshot.promptBlock = formatPromptBlock(snapshot);
		return snapshot;
	} catch {
		return empty;
	}
}

function formatPromptBlock(s: CompetitiveSnapshot): string {
	const lines: string[] = [];
	lines.push(
		`Active real women on the platform (last ${ACTIVE_WINDOW_DAYS}d): ${s.realWomenActive}`
	);
	lines.push(
		`Active real men — his actual competition (last ${ACTIVE_WINDOW_DAYS}d): ${s.realMenActive}`
	);

	if (s.trustRank) {
		const { score, rank, total, percentile } = s.trustRank;
		lines.push(
			`His Trust Score standing: ${score}/100 — ranked #${rank} of ${total} real men (top ${percentile}%).`
		);
		if (rank === 1) {
			lines.push(
				`He is ALREADY the highest-verified real man on the platform. Do NOT push him to grind for more trust points — there is almost no competitive gap left to close on verification. His leverage now is making moves on matches, not uploading more proof.`
			);
		}
	}

	if (s.matchRivals.length) {
		for (const m of s.matchRivals) {
			if (m.filtered) {
				lines.push(
					`Real, active men who qualify to pursue ${m.firstName}: ${m.qualifiedRivals}.` +
						(m.qualifiedRivals === 0
							? ` He has effectively no live competition for her — the opening is his to lose.`
							: '')
				);
			} else {
				lines.push(
					`Real, active men in the field around ${m.firstName}: ${m.qualifiedRivals} (not preference-filtered — she has no distilled profile yet).`
				);
			}
		}
	}

	return (
		`\n\nCOMPETITIVE INTELLIGENCE SNAPSHOT (real platform data, computed just now — these are the ONLY real numbers you may cite):\n` +
		lines.map((l) => `- ${l}`).join('\n') +
		`\n\nRULES for using this snapshot:\n` +
		`- These counts are the ground truth. NEVER invent or estimate user counts, rival counts, percentages, or trust-point totals beyond what is stated here and in his verified proofs.\n` +
		`- His Trust Score is capped at 100. Do NOT promise large point jumps (e.g. "+26", "get to +50") — frame any upload by how it helps a specific match see him, not by fictional point math.\n` +
		`- Anything already in his Verified Proofs is DONE and counted. Celebrate it; never ask him to upload it again.\n` +
		`- If real competition is low, lead with that as encouragement and steer him toward acting on his matches rather than more verification.`
	);
}
