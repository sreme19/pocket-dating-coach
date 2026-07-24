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
import { loadProofSignals } from './proof-signals';
import { loadVerificationStatusContext } from './verification-status-context';
import { seasonAdvisorBlock, networkingSeasonEnabled, networkingEnforcementEnabled, shouldShowSwitchBackNudge } from './networking-season';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface BestieAdvisorContext {
	/** Her resolved first name (falls back to 'her'). */
	userName: string;
	/** "<Name>'s preferences:" block (empty if none set). */
	prefsContext: string;
	/** "<Name>'s current matches" block (with bios, messages, proofs). */
	matchContext: string;
	/**
	 * Ground-truth "HER VERIFICATION STATUS" block — which verification steps she
	 * has actually completed and which she hasn't, plus her own uploaded proofs.
	 * The advisor previously had NO data about her own verification and would
	 * hallucinate that she'd "done all of it"; this is the authoritative source.
	 */
	verificationContext: string;
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
	// Phase 4: the nudge-cadence columns are only selected when enforcement is on,
	// so with the flag off this read has no dependency on the Phase 4 migration.
	const enforce = networkingEnforcementEnabled();
	const userCols =
		'first_name, hard_nos, discovery_mode' +
		(enforce ? ', season_nudge_last_at, season_nudge_opted_out' : '');
	const { data: userRow } = await (supabase as any)
		.from('verified_vibe_users')
		.select(userCols)
		.eq('id', userId)
		.single();
	const userName: string = userRow?.first_name || 'her';
	// hard_nos = her canonical, user-declared dealbreakers. Surfaced even when she
	// has no ai_assistant_profiles row yet, and merged with the AI's overlay below.
	const hardNos: string[] = Array.isArray(userRow?.hard_nos)
		? (userRow.hard_nos as unknown[]).map((h) => `${h}`.trim()).filter(Boolean)
		: [];

	// ── Load preferences ────────────────────────────────────────────────────
	let prefsContext = '';
	let preferencesData: unknown = null;
	const parts: string[] = [];
	let prefDealbreakers: string[] = [];
	try {
		const prefs = await loadPreferences(userId);
		preferencesData = prefs;
		prefDealbreakers = prefs.dealbreakers;
		if (prefs.emotionalSignals.length)
			parts.push(`Green flags she values: ${prefs.emotionalSignals.join(', ')}`);
		if (prefs.boundaries.length) parts.push(`Hard boundaries: ${prefs.boundaries.join(', ')}`);
		if (prefs.maturitySignals.length)
			parts.push(`Maturity signals she looks for: ${prefs.maturitySignals.join(', ')}`);
		if (prefs.privateCompatibilityNotes.length)
			parts.push(`Private notes: ${prefs.privateCompatibilityNotes.join(', ')}`);
	} catch {
		// gracefully skip if preferences not set up yet — hard_nos still surfaces
	}
	// Declared hard_nos ∪ ai_assistant_profiles.dealbreakers (the AI overlay) — keep
	// both. Dealbreakers stay first in the block.
	const dealbreakers = Array.from(new Set([...hardNos, ...prefDealbreakers]));
	if (dealbreakers.length) parts.unshift(`Dealbreakers: ${dealbreakers.join(', ')}`);
	if (parts.length) prefsContext = `\n\n${userName}'s preferences:\n${parts.join('\n')}`;
	// Networking Season (Phase 3): if she's in a networking season, prepend the
	// platonic "networking buddy" grounding so it leads her advisor context.
	// No-op ('') when the flag is off or she's dating. Phase 4 gates the
	// switch-back nudge line by opt-out + a ~2-week cadence.
	const includeSwitchBack = shouldShowSwitchBackNudge(
		userRow?.season_nudge_last_at,
		userRow?.season_nudge_opted_out,
	);
	prefsContext = seasonAdvisorBlock(userRow?.discovery_mode, { includeSwitchBack }) + prefsContext;
	// When the nudge actually renders under enforcement, stamp the cooldown so it
	// won't fire again for ~2 weeks. Throttled by design, so the extra write is rare.
	if (enforce && includeSwitchBack && networkingSeasonEnabled() && userRow?.discovery_mode === 'networking') {
		try {
			await (supabase as any)
				.from('verified_vibe_users')
				.update({ season_nudge_last_at: new Date().toISOString() })
				.eq('id', userId);
		} catch { /* non-fatal */ }
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
				.select('content, sender_id, created_at, is_ai')
				.eq('match_id', match.id)
				.order('created_at', { ascending: false })
				.limit(6);

			const msgs = (recentMsgs ?? []).reverse();

			// For insights intent, flag matches with activity in the last 48 h
			const recentActivity =
				cutoff && msgs.some((m) => new Date(m.created_at).getTime() > cutoff);

			// Speaker labels. Her side is split in two: messages SHE typed vs.
			// messages the AI Bestie sent on her behalf during hand-off (is_ai).
			// verified_vibe_messages stamps both with sender_id = her id, so without
			// the is_ai split a summary attributes the Bestie's own hand-off lines to
			// her — the advisor literally can't tell its words from hers.
			const anyAiMsg = msgs.some((m) => m.sender_id === userId && (m as any).is_ai);
			const msgText =
				msgs.length > 0
					? msgs
							.map((m) => {
								if (m.sender_id !== userId) return `${otherUser.first_name}: ${m.content}`;
								return (m as any).is_ai
									? `AI Bestie (sent for ${userName}): ${m.content}`
									: `${userName}: ${m.content}`;
							})
							.join('\n')
					: 'No messages yet';

			// Load match's verified proofs (pipeline + legacy artifacts, merged) —
			// proactively signal verified lifestyle claims.
			let artifactLine = '';
			try {
				const proofSignals = await loadProofSignals(supabase as any, otherUserId);
				if (proofSignals.lines.length) {
					artifactLine = `\nVerified proofs on his profile: ${proofSignals.lines.join('; ')}`;
				}
			} catch {
				/* skip */
			}

			const freshTag = recentActivity ? ' 🆕 (active in last 48h)' : '';
			// When any line was AI-sent, remind the advisor to keep the two apart so a
			// summary never says "you told him X" about a message the Bestie sent.
			const aiNote = anyAiMsg
				? `\n(NOTE: lines marked "AI Bestie (sent for ${userName})" were sent by you on her behalf during hand-off — NOT her own words. Attribute them correctly when summarising.)`
				: '';
			details.push(
				`**${otherUser.first_name}**, ${otherUser.age}${freshTag}\nBio: ${otherUser.about?.slice(0, 120) ?? 'n/a'}${artifactLine}\nRecent messages:\n${msgText}${aiNote}`
			);
		}

		const remaining = matches.length > 6 ? ` (+${matches.length - 6} more)` : '';
		matchContext = `\n\n${userName}'s current matches (${matches.length} total${remaining}):\n\n${details.join('\n\n---\n\n')}`;
	}

	// ── Her own verification ground truth ────────────────────────────────────
	// Which steps she has actually completed vs. not. Without this the advisor
	// has no data on her verification and hallucinates that it's all done. Shared
	// with the AI Wingman via loadVerificationStatusContext.
	const verificationContext = await loadVerificationStatusContext(supabase, userId, {
		subject: 'woman',
		name: userName
	});

	return {
		userName,
		prefsContext,
		matchContext,
		verificationContext,
		nameToMatchId,
		matchCount,
		preferencesData
	};
}
