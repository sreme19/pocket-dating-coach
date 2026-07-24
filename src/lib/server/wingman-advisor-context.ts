// ============================================================
// wingman-advisor-context.ts — shared context loader for the AI Wingman advisor
//
// The live advisor endpoint (src/routes/api/verified-vibe/ai-wingman/chat) and
// the admin Test Suite both need the EXACT same profile/match context assembled
// into the system prompt. This module is the single source of truth for that
// assembly so the two paths can never drift again.
//
// It reads (in order of preference):
//   user_master_profile  → source of truth (identity, generated copy, verified proofs)
//   ai_assistant_profiles → legacy fallback (PersonalityProfile shape)
//   user_artifacts        → trust artifacts already uploaded
//   attention_messages    → Secret Admirers / Craving Attention (warm leads)
//   verified_vibe_matches → current matches + their abstracted preferences
//
// It performs NO writes and pops NO pending reports — callers add side effects.
// ============================================================

import { loadPersonality } from './profile-service';
import { loadVerificationStatusContext } from './verification-status-context';
import { seasonAdvisorBlock, networkingSeasonEnabled, networkingEnforcementEnabled, shouldShowSwitchBackNudge } from './networking-season';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface WingmanAdvisorContext {
	/** "His master profile" / legacy "His personality on file" block. */
	personalityContext: string;
	/** "Verified proofs on his profile" block. */
	masterProfileContext: string;
	/** "Trust artifacts already verified" block. */
	artifactsContext: string;
	/** "People who already showed interest in him" block. */
	admirerContext: string;
	/** "His current matches" block (with abstracted preferences). */
	matchContext: string;
	/**
	 * Ground-truth "HIS VERIFICATION STATUS" block — which verification steps he
	 * has actually completed and which he hasn't, plus his uploaded proofs. Without
	 * it the advisor has no data on his verification and hallucinates it's all done.
	 */
	verificationContext: string;
	/** Which table the personality block was sourced from (for the trace). */
	profileSource: 'user_master_profile' | 'ai_assistant_profiles' | 'default';
	/** Raw profile object that fed the prompt (for the trace). */
	profileData: unknown;
	/** Number of mutual matches found (for the trace). */
	matchCount: number;
}

export interface LoadWingmanAdvisorContextOpts {
	/** 'insights' applies a 48h recency window to flag freshly-active matches. */
	intent?: 'chat' | 'summary' | 'insights';
}

/**
 * Assemble the full AI Wingman advisor context for a male user. Read-only.
 * Returns the context strings the system-prompt builder interpolates, plus
 * provenance metadata for the observability trace.
 */
export async function loadWingmanAdvisorContext(
	supabase: SupabaseClient,
	userId: string,
	opts: LoadWingmanAdvisorContextOpts = {}
): Promise<WingmanAdvisorContext> {
	const intent = opts.intent ?? 'chat';

	// Networking Season (Phase 3): his season governs whether Wingman coaches in
	// platonic "networking buddy" mode. Cheap standalone read (owner data here
	// otherwise comes from user_master_profile). Defaults to date on any failure.
	let ownerDiscoveryMode: unknown = null;
	let seasonRow: any = null;
	const enforce = networkingEnforcementEnabled();
	try {
		const cols = 'discovery_mode' + (enforce ? ', season_nudge_last_at, season_nudge_opted_out' : '');
		const res = await (supabase as any)
			.from('verified_vibe_users')
			.select(cols)
			.eq('id', userId)
			.maybeSingle();
		seasonRow = res.data;
		ownerDiscoveryMode = seasonRow?.discovery_mode ?? null;
	} catch { /* default → date */ }

	// ── Load master profile (user_master_profile — source of truth) ─────────
	let personalityContext = '';
	let masterProfileContext = '';
	let profileSource: WingmanAdvisorContext['profileSource'] = 'default';
	let profileData: unknown = null;
	try {
		const { data: masterRow } = await (supabase as any)
			.from('user_master_profile')
			.select('data')
			.eq('user_id', userId)
			.maybeSingle();

		if (masterRow?.data) {
			profileSource = 'user_master_profile';
			const m = masterRow.data as Record<string, unknown>;
			profileData = m;
			const parts: string[] = [];

			// Identity
			const identity = m.identity as Record<string, unknown> | undefined;
			if (identity?.archetype) parts.push(`Archetype: ${String(identity.archetype).replace(/_/g, ' ')}`);
			if (identity?.city)      parts.push(`City: ${identity.city}`);

			// Generated profile copy
			const gp = m.generatedProfile as Record<string, unknown> | undefined;
			if (gp?.about)                   parts.push(`His bio: "${gp.about}"`);
			if (Array.isArray(gp?.personalityDescriptors) && gp.personalityDescriptors.length)
				parts.push(`Personality: ${(gp.personalityDescriptors as string[]).join(', ')}`);
			if (Array.isArray(gp?.lifestyleTags) && gp.lifestyleTags.length)
				parts.push(`Lifestyle tags: ${(gp.lifestyleTags as string[]).join(', ')}`);
			if (gp?.intentStatement) parts.push(`Looking for: ${gp.intentStatement}`);

			// Countries traveled
			const countries = m.countriesTraveled as string[] | undefined;
			if (Array.isArray(countries) && countries.length)
				parts.push(`Countries he's been to: ${countries.join(', ')}`);

			if (parts.length) {
				personalityContext = `\n\nHis master profile:\n${parts.join('\n')}`;
			}

			// Verified proofs (richer than trust artifacts)
			const proofs = m.verifiedProofs as Array<Record<string, unknown>> | undefined;
			if (Array.isArray(proofs) && proofs.length) {
				const proofLines = proofs.map((p) => {
					const summary = p.aggregated
						? `"${p.aggregated}"`
						: Array.isArray(p.insights)
							? (p.insights as Array<{label: string}>).map(i => i.label).join(', ')
							: 'verified';
					return `• ${String(p.category).replace(/_/g, ' ')}: ${summary}`;
				});
				masterProfileContext = `\n\nVerified proofs on his profile (CONFIRMED facts — use to coach him and frame advice around his real strengths):\n${proofLines.join('\n')}`;
			}
		} else {
			// Fallback to legacy loadPersonality if no master profile yet
			profileSource = 'ai_assistant_profiles';
			const p = await loadPersonality(userId);
			profileData = p;
			const parts: string[] = [];
			if (p.communicationStyle) parts.push(`Communication style: ${p.communicationStyle}`);
			if (p.personalityVibe)    parts.push(`Vibe: ${p.personalityVibe}`);
			if (p.mattersMost)        parts.push(`What matters most: ${p.mattersMost}`);
			if (p.values?.length)     parts.push(`Values: ${p.values.join(', ')}`);
			if (parts.length) personalityContext = `\n\nHis personality on file:\n${parts.join('\n')}`;
		}
	} catch { /* skip if not set up */ }

	// ── Load trust artifacts ──────────────────────────────────────────────
	let artifactsContext = '';
	try {
		const { data: artifacts } = await (supabase as any)
			.from('user_artifacts')
			.select('claim_tag, description, trust_points')
			.eq('user_id', userId)
			.order('created_at', { ascending: false });

		if (artifacts?.length) {
			const grouped: Record<string, string[]> = {};
			for (const a of artifacts) {
				(grouped[a.claim_tag] = grouped[a.claim_tag] || []).push(a.description || a.claim_tag);
			}
			const lines = Object.entries(grouped).map(
				([tag, items]) => `- ${tag} (${items.length} file${items.length > 1 ? 's' : ''}): ${items.join(', ')}`
			);
			artifactsContext = `\n\nTrust artifacts already verified — DO NOT ask him for these again:\n${lines.join('\n')}`;
		}
	} catch { /* skip */ }

	// ── Load Secret Admirers / Craving Attention received ────────────────────
	let admirerContext = '';
	try {
		const { data: admirers } = await (supabase as any)
			.from('attention_messages')
			.select('sender_id, message_type, content, reply_content, is_read, created_at')
			.eq('recipient_id', userId)
			.order('created_at', { ascending: false })
			.limit(10);

		if ((admirers as any[])?.length) {
			const admLines: string[] = [];
			for (const adm of (admirers as any[])) {
				const { data: sender } = await supabase
					.from('verified_vibe_users')
					.select('first_name, age, archetype')
					.eq('id', adm.sender_id)
					.single();

				if (!sender) continue;

				const typeLabel = adm.message_type === 'secret_admirer' ? 'Secret Admirer 🌹' : 'Craving Attention';
				const replyStatus = adm.reply_content
					? `replied ✓`
					: adm.is_read
						? 'seen, no reply yet'
						: '🆕 unread';
				const diffMs = Date.now() - new Date(adm.created_at).getTime();
				const diffMins = Math.floor(diffMs / 60000);
				const timeLabel = diffMins < 60
					? `${diffMins}m ago`
					: diffMins < 1440
						? `${Math.floor(diffMins / 60)}h ago`
						: `${Math.floor(diffMins / 1440)}d ago`;

				admLines.push(
					`- **${sender.first_name}**, ${sender.age} (${sender.archetype}) — ${typeLabel} — sent ${timeLabel}: "${adm.content.slice(0, 120)}" [${replyStatus}]`
				);
			}
			if (admLines.length) {
				const unread = (admirers as any[]).filter((a: any) => !a.is_read).length;
				const unreadNote = unread > 0 ? ` (${unread} unread)` : '';
				admirerContext = `\n\nPeople who already showed interest in him${unreadNote} — these are WARM leads he hasn't matched with yet:\n${admLines.join('\n')}`;
			}
		}
	} catch { /* skip if table not ready */ }

	// ── Load matches + their abstracted preferences ────────────────────────
	const { data: matches } = await supabase
		.from('verified_vibe_matches')
		.select('id, user1_id, user2_id, created_at')
		.eq('status', 'mutual')
		.or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
		.order('created_at', { ascending: false })
		.limit(10);

	let matchContext = '';
	const matchCount = matches?.length ?? 0;

	if (!matches || matches.length === 0) {
		matchContext = '\n\nHe has no matches yet.';
	} else {
		const cutoff = intent === 'insights' ? Date.now() - 48 * 60 * 60 * 1000 : null;
		const details: string[] = [];

		for (const match of matches.slice(0, 6)) {
			const otherId = match.user1_id === userId ? match.user2_id : match.user1_id;

			const { data: otherUser } = await supabase
				.from('verified_vibe_users')
				.select('first_name, age, about, archetype')
				.eq('id', otherId)
				.single();

			if (!otherUser) continue;

			// Load her preferences — abstracted, never quoted directly
			let prefSignals: string[] = [];
			try {
				const { data: prefs } = await supabase
					.from('ai_assistant_profiles')
					.select('data')
					.eq('user_id', otherId)
					.eq('profile_type', 'preferences')
					.order('version', { ascending: false })
					.limit(1)
					.single();

				const p = prefs?.data as any;
				if (p) {
					if (p.emotionalSignals?.length) prefSignals.push(`values: ${p.emotionalSignals.slice(0,3).join(', ')}`);
					if (p.dealbreakers?.length) prefSignals.push(`dealbreakers: ${p.dealbreakers.slice(0,2).join(', ')}`);
					if (p.boundaries?.length) prefSignals.push(`hard boundaries: ${p.boundaries.slice(0,2).join(', ')}`);
				}
			} catch { /* graceful skip */ }

			// Load anonymous tips received on her profile
			let tipSignals: string[] = [];
			try {
				const { data: tips } = await (supabase as any)
					.from('profile_tips')
					.select('tip_tags')
					.eq('target_user_id', otherId);

				const tagCounts: Record<string, number> = {};
				for (const t of tips ?? []) {
					for (const tag of t.tip_tags ?? []) {
						tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
					}
				}
				const topTags = Object.entries(tagCounts)
					.sort(([,a],[,b]) => b - a)
					.slice(0, 3)
					.map(([tag, count]) => `${tag} (${count}x)`);
				if (topTags.length) tipSignals.push(`community reads: ${topTags.join(', ')}`);
			} catch { /* skip */ }

			const { data: recentMsgs } = await supabase
				.from('verified_vibe_messages')
				.select('content, sender_id, created_at, is_ai')
				.eq('match_id', match.id)
				.order('created_at', { ascending: false })
				.limit(6);

			const msgs = (recentMsgs ?? []).reverse();
			const recentActivity = cutoff && msgs.some(m => new Date(m.created_at).getTime() > cutoff);
			const freshTag = recentActivity ? ' 🆕 (active recently)' : '';
			// Her side splits in two: messages SHE typed vs. messages her AI Bestie
			// sent as her proxy while screening him (is_ai). The man is told up front
			// he's talking to her Bestie, so surfacing the distinction here just lets
			// the Wingman coach accurately (e.g. "she's now replying herself").
			const anyBestieMsg = msgs.some(m => m.sender_id !== userId && (m as any).is_ai);
			const msgText = msgs.length > 0
				? msgs.map(m => {
					if (m.sender_id === userId) return `Him: ${m.content}`;
					return (m as any).is_ai
						? `${otherUser.first_name}'s AI Bestie: ${m.content}`
						: `${otherUser.first_name}: ${m.content}`;
				}).join('\n')
				: 'No messages yet';

			const prefLine = prefSignals.length
				? `\nHer signals (use to coach him, don't quote directly): ${prefSignals.join(' | ')}`
				: '';
			const tipLine = tipSignals.length ? `\n${tipSignals.join(' | ')}` : '';
			// When her Bestie was the proxy, remind the Wingman so it doesn't credit her
			// directly for the Bestie's screening — and can flag when she steps in herself.
			const bestieNote = anyBestieMsg
				? `\n(NOTE: lines marked "${otherUser.first_name}'s AI Bestie" were sent by her AI Bestie proxy screening him on her behalf, NOT ${otherUser.first_name} herself. Lines marked just "${otherUser.first_name}" are her own words — a signal she's stepped in.)`
				: '';

			details.push(
				`**${otherUser.first_name}**, ${otherUser.age} — ${otherUser.archetype}${freshTag}\nBio: ${otherUser.about?.slice(0, 100) ?? 'n/a'}${prefLine}${tipLine}\nRecent messages:\n${msgText}${bestieNote}`
			);
		}

		const remaining = matches.length > 6 ? ` (+${matches.length - 6} more)` : '';
		matchContext = `\n\nHis current matches (${matches.length} total${remaining}):\n\n${details.join('\n\n---\n\n')}`;
	}

	// ── His own verification ground truth ────────────────────────────────────
	// Which steps he has actually completed vs. not. Shared with the AI Bestie
	// via loadVerificationStatusContext.
	const verificationContext = await loadVerificationStatusContext(supabase, userId, {
		subject: 'man'
	});

	// Networking Season (Phase 3): lead his advisor context with platonic grounding
	// when he's in a networking season. No-op ('') when the flag is off or he's dating.
	// Phase 4 gates the switch-back nudge line by opt-out + a ~2-week cadence.
	const includeSwitchBack = shouldShowSwitchBackNudge(
		seasonRow?.season_nudge_last_at,
		seasonRow?.season_nudge_opted_out,
	);
	const personalityContextWithSeason =
		seasonAdvisorBlock(ownerDiscoveryMode, { includeSwitchBack }) + personalityContext;
	if (enforce && includeSwitchBack && networkingSeasonEnabled() && ownerDiscoveryMode === 'networking') {
		try {
			await (supabase as any)
				.from('verified_vibe_users')
				.update({ season_nudge_last_at: new Date().toISOString() })
				.eq('id', userId);
		} catch { /* non-fatal */ }
	}

	return {
		personalityContext: personalityContextWithSeason,
		masterProfileContext,
		artifactsContext,
		admirerContext,
		matchContext,
		verificationContext,
		profileSource,
		profileData,
		matchCount
	};
}
