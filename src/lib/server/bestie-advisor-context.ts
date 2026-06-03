// ============================================================
// bestie-advisor-context.ts — shared context loader for the AI Bestie advisor
//
// The live advisor endpoint (src/routes/api/verified-vibe/ai-bestie/chat) and
// the admin Test Suite both need the EXACT same name/preferences/match context
// assembled into the system prompt. This module is the single source of truth
// for that assembly so the two paths can never drift (mirrors
// wingman-advisor-context.ts on the male side).
//
// It reads:
//   verified_vibe_users   → her first name
//   ai_assistant_profiles → her preferences (via profile-service)
//   verified_vibe_matches → current matches + their bio, recent messages, and
//                           verified lifestyle proofs
//
// It performs NO writes and pops NO pending reports — callers add side effects.
// ============================================================

import { loadPreferences } from './profile-service';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface BestieAdvisorContext {
	/** Her resolved first name (falls back to 'her'). */
	userName: string;
	/** "<Name>'s preferences:" block (empty if none set). */
	prefsContext: string;
	/** "<Name>'s current matches" block (with bios, messages, proofs). */
	matchContext: string;
	/** Lower-cased match first name → match id, for DRAFT marker resolution. */
	nameToMatchId: Record<string, string>;
	/** Number of mutual matches found (for the trace). */
	matchCount: number;
	/** Raw preferences object that fed the prompt (for the trace). */
	preferencesData: unknown;
}

export interface LoadBestieAdvisorContextOpts {
	/** 'insights' applies a 48h recency window to flag freshly-active matches. */
	intent?: 'chat' | 'summary' | 'insights';
}

/**
 * Assemble the full AI Bestie advisor context for a female user. Read-only.
 * Returns the context strings the system-prompt builder interpolates, plus the
 * name→matchId map the endpoint needs to resolve DRAFT markers.
 */
export async function loadBestieAdvisorContext(
	supabase: SupabaseClient,
	userId: string,
	opts: LoadBestieAdvisorContextOpts = {}
): Promise<BestieAdvisorContext> {
	const intent = opts.intent ?? 'chat';

	// ── Resolve her first name ──────────────────────────────────────────────
	const { data: userRow } = await (supabase as any)
		.from('verified_vibe_users')
		.select('first_name')
		.eq('id', userId)
		.single();
	const userName: string = userRow?.first_name || 'her';

	// ── Load preferences ────────────────────────────────────────────────────
	let prefsContext = '';
	let preferencesData: unknown = null;
	try {
		const prefs = await loadPreferences(userId);
		preferencesData = prefs;
		const parts: string[] = [];
		if (prefs.dealbreakers.length) parts.push(`Dealbreakers: ${prefs.dealbreakers.join(', ')}`);
		if (prefs.emotionalSignals.length)
			parts.push(`Green flags she values: ${prefs.emotionalSignals.join(', ')}`);
		if (prefs.boundaries.length) parts.push(`Hard boundaries: ${prefs.boundaries.join(', ')}`);
		if (prefs.maturitySignals.length)
			parts.push(`Maturity signals she looks for: ${prefs.maturitySignals.join(', ')}`);
		if (prefs.privateCompatibilityNotes.length)
			parts.push(`Private notes: ${prefs.privateCompatibilityNotes.join(', ')}`);
		if (parts.length) prefsContext = `\n\n${userName}'s preferences:\n${parts.join('\n')}`;
	} catch {
		// gracefully skip if preferences not set up yet
	}

	// ── Fetch matches with recent messages + proofs ──────────────────────────
	const { data: matches } = await supabase
		.from('verified_vibe_matches')
		.select('id, user1_id, user2_id, created_at')
		.eq('status', 'mutual')
		.or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
		.order('created_at', { ascending: false })
		.limit(10);

	let matchContext = '';
	const nameToMatchId: Record<string, string> = {};
	const matchCount = matches?.length ?? 0;

	if (!matches || matches.length === 0) {
		matchContext = `\n\n${userName} has no matches yet.`;
	} else {
		const cutoff = intent === 'insights' ? Date.now() - 48 * 60 * 60 * 1000 : null;
		const details: string[] = [];

		for (const match of matches.slice(0, 6)) {
			const otherUserId = match.user1_id === userId ? match.user2_id : match.user1_id;

			const { data: otherUser } = await supabase
				.from('verified_vibe_users')
				.select('first_name, age, about')
				.eq('id', otherUserId)
				.single();

			if (!otherUser) continue;

			// Track name → match ID for draft resolution
			nameToMatchId[otherUser.first_name.toLowerCase()] = match.id;

			const { data: recentMsgs } = await supabase
				.from('verified_vibe_messages')
				.select('content, sender_id, created_at')
				.eq('match_id', match.id)
				.order('created_at', { ascending: false })
				.limit(6);

			const msgs = (recentMsgs ?? []).reverse();

			// For insights intent, flag matches with activity in the last 48 h
			const recentActivity =
				cutoff && msgs.some((m) => new Date(m.created_at).getTime() > cutoff);

			const msgText =
				msgs.length > 0
					? msgs
							.map((m) => `${m.sender_id === userId ? userName : otherUser.first_name}: ${m.content}`)
							.join('\n')
					: 'No messages yet';

			// Load match's trust artifacts — proactively signal verified lifestyle claims
			let artifactLine = '';
			try {
				const { data: artifacts } = await (supabase as any)
					.from('user_artifacts')
					.select('claim_tag, trust_points')
					.eq('user_id', otherUserId);

				if (artifacts?.length) {
					const tagCounts: Record<string, number> = {};
					for (const a of artifacts) {
						tagCounts[a.claim_tag] = (tagCounts[a.claim_tag] ?? 0) + 1;
					}
					const parts = Object.entries(tagCounts).map(
						([tag, count]) => `${tag}${count > 1 ? ` (×${count})` : ''}`
					);
					artifactLine = `\nVerified lifestyle proofs uploaded: ${parts.join(', ')}`;
				}
			} catch {
				/* skip */
			}

			const freshTag = recentActivity ? ' 🆕 (active in last 48h)' : '';
			details.push(
				`**${otherUser.first_name}**, ${otherUser.age}${freshTag}\nBio: ${otherUser.about?.slice(0, 120) ?? 'n/a'}${artifactLine}\nRecent messages:\n${msgText}`
			);
		}

		const remaining = matches.length > 6 ? ` (+${matches.length - 6} more)` : '';
		matchContext = `\n\n${userName}'s current matches (${matches.length} total${remaining}):\n\n${details.join('\n\n---\n\n')}`;
	}

	return { userName, prefsContext, matchContext, nameToMatchId, matchCount, preferencesData };
}
