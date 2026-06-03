/**
 * Competitive Intelligence Snapshot
 *
 * A LIGHTWEIGHT, synchronous competitive read computed inline before the AI
 * Wingman / AI Bestie advisor generates — distinct from the heavy, LLM-driven
 * async report in matchmaker-service.ts (generatePerMatchRanking), which lands a
 * turn too late to ground the reply (see RCA: report completes ~40s after the
 * reply is sent).
 *
 * This snapshot is cheap SQL only — no Claude calls — so it can block the
 * request without adding meaningful latency. It answers the three questions the
 * advisors keep hallucinating answers to (framed from the OWNER's side):
 *   a) how many REAL people of the opposite gender are active right now (options)
 *   b) how many REAL people of the owner's gender are active (the competition pool)
 *   c) how many REAL same-gender rivals qualify to pursue each of the owner's matches
 * Plus the owner's normalized standing among real users of the same gender
 * (trust_score is otherwise an absolute, population-blind number — see RCA point 1).
 *
 * Works for either gender: a male owner is ranked among real men and his rivals
 * are other men; a female owner is ranked among real women and her rivals are
 * other women. The hard filter is always run in its canonical (male, female)
 * argument order regardless of which side the owner is on.
 *
 * "Real"   = is_seed = false (excludes seed/demo profiles).
 * "Active" = last_active_at within ACTIVE_WINDOW_DAYS.
 */

import { hardFilter, type WingmanPoolRow, type BestiePoolRow } from './matchmaker-service';

const ACTIVE_WINDOW_DAYS = 7;

export interface CompetitiveSnapshot {
	realWomenActive: number;
	realMenActive: number;
	/** Which gender the snapshot was computed for. null = owner gender unknown. */
	ownerGender: 'man' | 'woman' | null;
	trustRank: { score: number; rank: number; total: number; percentile: number } | null;
	matchRivals: Array<{ firstName: string; qualifiedRivals: number; filtered: boolean }>;
	/** Pre-formatted block ready to splice into the advisor system prompt. */
	promptBlock: string;
}

/**
 * Compute the snapshot for the requesting user. Never throws — on any failure it
 * returns a zeroed snapshot with an empty promptBlock so the advisor degrades to
 * its prior behaviour rather than erroring the chat.
 */
export async function buildCompetitiveSnapshot(
	supabase: unknown,
	userId: string
): Promise<CompetitiveSnapshot> {
	const empty: CompetitiveSnapshot = {
		realWomenActive: 0,
		realMenActive: 0,
		ownerGender: null,
		trustRank: null,
		matchRivals: [],
		promptBlock: '',
	};

	try {
		const db = supabase as any;
		const activeCutoff = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

		// ── Owner gender — decides which side is "competition" vs "options" ──
		const { data: owner } = await db
			.from('verified_vibe_users')
			.select('gender')
			.eq('id', userId)
			.maybeSingle();
		const ownerGender: 'man' | 'woman' | null =
			owner?.gender === 'man' ? 'man' : owner?.gender === 'woman' ? 'woman' : null;
		if (!ownerGender) return empty;
		const isMan = ownerGender === 'man';

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

		// ── Normalized trust standing among ALL real same-gender users (RCA pt 1) ──
		// Absolute trust_score is population-blind; rank the owner against the real
		// field of their OWN gender so the advisor stops pushing impossible
		// point-grinding.
		const { data: realPeers } = await db
			.from('verified_vibe_users')
			.select('id, trust_score')
			.eq('is_seed', false)
			.eq('gender', ownerGender);

		let trustRank: CompetitiveSnapshot['trustRank'] = null;
		if (Array.isArray(realPeers) && realPeers.length) {
			const me = realPeers.find((m: any) => m.id === userId);
			if (me) {
				const myScore = me.trust_score ?? 0;
				const total = realPeers.length;
				// Rank: 1 = highest. Ties share the better (lower) rank.
				const ahead = realPeers.filter((m: any) => (m.trust_score ?? 0) > myScore).length;
				const rank = ahead + 1;
				// "top X%" — smaller is better. rank 1 of 3 → top 33%.
				const percentile = Math.max(1, Math.round((rank / total) * 100));
				trustRank = { score: myScore, rank, total, percentile };
			}
		}

		// ── (c) Qualified rivals per match (real same-gender users who pass the
		//        partner's filter) ─────────────────────────────────────────────
		const { data: matches } = await db
			.from('verified_vibe_matches')
			.select('id, user1_id, user2_id, status')
			.or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
			.eq('status', 'mutual');

		const matchRivals: CompetitiveSnapshot['matchRivals'] = [];

		if (Array.isArray(matches) && matches.length) {
			// Real, active same-gender users other than the owner — the candidate
			// rival set. Their pool rows come from the table for the owner's gender.
			const rivalTable = isMan ? 'vv_pool_wingmen' : 'vv_pool_besties';
			const { data: rivalUsers } = await db
				.from('verified_vibe_users')
				.select('id')
				.eq('is_seed', false)
				.eq('gender', ownerGender)
				.gte('last_active_at', activeCutoff)
				.neq('id', userId);
			const rivalIds: string[] = (rivalUsers ?? []).map((r: any) => r.id);

			let rivalPoolRows: Array<WingmanPoolRow | BestiePoolRow> = [];
			if (rivalIds.length) {
				const { data: pool } = await db
					.from(rivalTable)
					.select('*')
					.in('user_id', rivalIds);
				rivalPoolRows = (pool ?? []) as Array<WingmanPoolRow | BestiePoolRow>;
			}

			// The partner of each match is the opposite gender; pull their pool row
			// from the opposite table to run the production hard filter against.
			const partnerTable = isMan ? 'vv_pool_besties' : 'vv_pool_wingmen';

			for (const match of matches as Array<{ user1_id: string; user2_id: string }>) {
				const partnerId = match.user1_id === userId ? match.user2_id : match.user1_id;
				const [{ data: partnerPool }, { data: partnerUser }] = await Promise.all([
					db.from(partnerTable).select('*').eq('user_id', partnerId).single(),
					db.from('verified_vibe_users').select('first_name').eq('id', partnerId).single(),
				]);
				const firstName = partnerUser?.first_name ?? 'your match';

				if (partnerPool) {
					// Real active same-gender users whose pool row passes the partner's
					// hard filters = genuine rivals. hardFilter is always (male, female):
					// for a male owner the rival is the male side and the partner the
					// female side; for a female owner those roles flip.
					const qualified = rivalPoolRows.filter((r) =>
						isMan
							? !hardFilter(r as WingmanPoolRow, partnerPool as BestiePoolRow, false)
							: !hardFilter(partnerPool as WingmanPoolRow, r as BestiePoolRow, false)
					).length;
					matchRivals.push({ firstName, qualifiedRivals: qualified, filtered: true });
				} else {
					// No distilled profile to filter against — report the raw real-active
					// same-gender field and flag that it isn't preference-filtered.
					matchRivals.push({ firstName, qualifiedRivals: rivalIds.length, filtered: false });
				}
			}
		}

		const snapshot: CompetitiveSnapshot = {
			realWomenActive: womenCount ?? 0,
			realMenActive: menCount ?? 0,
			ownerGender,
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
	const isMan = s.ownerGender === 'man';
	// Owner-side pronouns.
	const sub = isMan ? 'he' : 'she';
	const Sub = isMan ? 'He' : 'She';
	const obj = isMan ? 'him' : 'her';
	const ownerWord = isMan ? 'man' : 'woman';
	// Opposite gender = the pool of people the owner can pursue (their "options").
	const optionsCount = isMan ? s.realWomenActive : s.realMenActive;
	const optionsWord = isMan ? 'women' : 'men';
	// Same gender = the owner's actual competition.
	const rivalsCount = isMan ? s.realMenActive : s.realWomenActive;
	const rivalsWord = isMan ? 'men' : 'women';
	// Partner = the matched person (opposite gender).
	const partnerSub = isMan ? 'she' : 'he';
	const partnerObj = isMan ? 'her' : 'him';
	const ownerPossessive = isMan ? 'his' : 'hers';

	const lines: string[] = [];
	lines.push(
		`Active real ${optionsWord} on the platform (last ${ACTIVE_WINDOW_DAYS}d): ${optionsCount}`
	);
	lines.push(
		`Active real ${rivalsWord} — ${isMan ? 'his' : 'her'} actual competition (last ${ACTIVE_WINDOW_DAYS}d): ${rivalsCount}`
	);

	if (s.trustRank) {
		const { score, rank, total, percentile } = s.trustRank;
		lines.push(
			`${isMan ? 'His' : 'Her'} Trust Score standing: ${score}/100 — ranked #${rank} of ${total} real ${rivalsWord} (top ${percentile}%).`
		);
		if (rank === 1) {
			lines.push(
				`${Sub} is ALREADY the highest-verified real ${ownerWord} on the platform. Do NOT push ${obj} to grind for more trust points — there is almost no competitive gap left to close on verification. ${Sub === 'He' ? 'His' : 'Her'} leverage now is making moves on matches, not uploading more proof.`
			);
		}
	}

	if (s.matchRivals.length) {
		for (const m of s.matchRivals) {
			if (m.filtered) {
				lines.push(
					`OTHER real, active ${rivalsWord} (excluding ${obj}) who qualify to pursue ${m.firstName}: ${m.qualifiedRivals}.` +
						(m.qualifiedRivals === 0
							? ` ${Sub} has effectively no live competition for ${partnerObj} — the opening is ${ownerPossessive} to lose.`
							: '')
				);
			} else {
				lines.push(
					`OTHER real, active ${rivalsWord} (excluding ${obj}) in the field around ${m.firstName}: ${m.qualifiedRivals} (not preference-filtered — ${partnerSub} has no distilled profile yet).`
				);
			}
		}
	}

	return (
		`\n\nCOMPETITIVE INTELLIGENCE SNAPSHOT (real platform data, computed just now — these are the ONLY real numbers you may cite):\n` +
		lines.map((l) => `- ${l}`).join('\n') +
		`\n\nRULES for using this snapshot:\n` +
		`- These counts are the ground truth. NEVER invent or estimate user counts, rival counts, percentages, or trust-point totals beyond what is stated here and in ${isMan ? 'his' : 'her'} verified proofs.\n` +
		`- ${isMan ? 'His' : 'Her'} Trust Score is capped at 100. Do NOT promise large point jumps (e.g. "+26", "get to +50") — frame any upload by how it helps a specific match see ${obj}, not by fictional point math.\n` +
		`- Anything already in ${isMan ? 'his' : 'her'} Verified Proofs is DONE and counted. Celebrate it; never ask ${obj} to upload it again. Before suggesting ANY upload, check the verified-proofs list above and only suggest a category ${sub} does NOT already have.\n` +
		`- If real competition is low, lead with that as encouragement and steer ${obj} toward acting on ${isMan ? 'his' : 'her'} matches rather than more verification.`
	);
}
