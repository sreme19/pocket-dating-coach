/**
 * POST /api/verified-vibe/ai-wingman/chat
 *
 * AI Wingman advisor chat for male VV users.
 * Reads the man's personality, his matches' preferences (abstracted — never dumped),
 * his uploaded trust artifacts, and anonymous tips. Grounds advice in book principles.
 *
 * Body:
 *   userId   string
 *   message  string   (empty for summary/insights intents)
 *   intent?  'chat' | 'summary' | 'insights'
 *   history? { role: 'user'|'assistant', content: string }[]
 *
 * Response: { reply: string }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getClaudeClient, CLAUDE_MODEL } from '$lib/claude';
import { getSupabase } from '$lib/server/supabase';
import { appendAdvisorChat } from '$lib/server/advisor-chat';
import { loadPersonality } from '$lib/server/profile-service';
import { touchLastActive } from '$lib/server/pool-registry';
import { popPendingChatMessage } from '$lib/server/intelligence-report-processor';
import { queueIntelligenceReport } from '$lib/server/matchmaker-service';
import { processIntelligenceReport } from '$lib/server/intelligence-report-processor';
import { complianceGate } from '$lib/server/ai-compliance';

// Phrases that indicate the user wants competitive/improvement intelligence
const INTELLIGENCE_INTENTS = [
  'how can i improve', 'how do i improve', 'how to improve',
  'better matches', 'get better matches', 'more matches',
  'improve my ranking', 'my ranking', 'how do i rank',
  'beat the competition', 'compete', 'how am i doing',
  'improve my fit', 'better fit', 'fit with her',
  'what should i work on', 'what can i do better',
  'how can i win', 'how do i win',
];

function detectsIntelligenceIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return INTELLIGENCE_INTENTS.some((phrase) => lower.includes(phrase));
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json() as {
			userId?: string;
			message?: string;
			intent?: 'chat' | 'summary' | 'insights';
			history?: { role: 'user' | 'assistant'; content: string }[];
		};

		const userId = (body.userId ?? '').trim();
		if (!userId) return json({ error: 'userId is required' }, { status: 400 });

		// Touch last_active and check for pending intelligence reports (fire-and-forget for active touch)
		touchLastActive(userId).catch(() => {});

		const intent = body.intent ?? 'chat';
		const rawMessage = (body.message ?? '').trim();
		const history = body.history ?? [];

		let userMessage = rawMessage;
		if (!userMessage) {
			if (intent === 'summary') {
				userMessage = "Give me a quick read of my matches. Who deserves my attention right now?";
			} else if (intent === 'insights') {
				userMessage = "What's new across my matches? Any fresh moves I should make?";
			} else {
				return json({ error: 'message is required for chat intent' }, { status: 400 });
			}
		}

		// ── Intelligence intent detection ─────────────────────────────────────
		// If the user is asking how to improve/compete, queue an intelligence report
		// and return an acknowledgement immediately so Claude can respond naturally.
		if (detectsIntelligenceIntent(userMessage)) {
			const reportId = await queueIntelligenceReport(userId, 'per_match_ranking', 'user_driven');
			processIntelligenceReport(reportId).catch(() => {});
		}

		// ── Pending report injection ──────────────────────────────────────────
		// If a previously generated report is waiting, inject it into the conversation
		// as additional context so Claude acknowledges and summarises it.
		const pendingReport = await popPendingChatMessage(userId).catch(() => null);
		const pendingReportContext = pendingReport
			? `\n\n--- INTELLIGENCE REPORT READY ---\nThe following competitive intelligence report was just generated for this user. Acknowledge it warmly and summarise the key action points before responding to his message:\n${pendingReport}\n--- END REPORT ---\n`
			: '';

		const supabase = getSupabase();

		// ── Load master profile (user_master_profile — source of truth) ─────────
		let personalityContext = '';
		let masterProfileContext = '';
		try {
			const { data: masterRow } = await (supabase as any)
				.from('user_master_profile')
				.select('data')
				.eq('user_id', userId)
				.maybeSingle();

			if (masterRow?.data) {
				const m = masterRow.data as Record<string, unknown>;
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
				const p = await loadPersonality(userId);
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
					.select('content, sender_id, created_at')
					.eq('match_id', match.id)
					.order('created_at', { ascending: false })
					.limit(6);

				const msgs = (recentMsgs ?? []).reverse();
				const recentActivity = cutoff && msgs.some(m => new Date(m.created_at).getTime() > cutoff);
				const freshTag = recentActivity ? ' 🆕 (active recently)' : '';
				const msgText = msgs.length > 0
					? msgs.map(m => `${m.sender_id === userId ? 'Him' : otherUser.first_name}: ${m.content}`).join('\n')
					: 'No messages yet';

				const prefLine = prefSignals.length
					? `\nHer signals (use to coach him, don't quote directly): ${prefSignals.join(' | ')}`
					: '';
				const tipLine = tipSignals.length ? `\n${tipSignals.join(' | ')}` : '';

				details.push(
					`**${otherUser.first_name}**, ${otherUser.age} — ${otherUser.archetype}${freshTag}\nBio: ${otherUser.about?.slice(0, 100) ?? 'n/a'}${prefLine}${tipLine}\nRecent messages:\n${msgText}`
				);
			}

			const remaining = matches.length > 6 ? ` (+${matches.length - 6} more)` : '';
			matchContext = `\n\nHis current matches (${matches.length} total${remaining}):\n\n${details.join('\n\n---\n\n')}`;
		}

		// ── Build system prompt ────────────────────────────────────────────────
		const systemPrompt = `You are AI Wingman — the personal dating advisor built for this guy on Verified Vibe, and honestly? He's got more going for him than he probably realises. Your job is to help him see that clearly and put it to work.

You have full context on his matches, his personality, and any trust evidence he's uploaded.

CRITICAL RULE on match preferences: You have access to signals about what his matches value and what their dealbreakers are. Use this to give him *approach advice* — what energy to bring, what to focus on, what to avoid. NEVER quote or dump her private preferences directly. The man earns those insights through the relationship, not through a data readout.

HOW UPLOADS WORK — understand this fully so you can explain it to him:
- Every file he uploads HERE (via the 📎 button in this chat) is stored permanently as a verified proof on his profile
- Each upload increases his Trust Score: Wealth = +10 pts, Travel = +8 pts, Fitness = +5 pts, General = +3 pts
- A higher Trust Score means he ranks higher in Discover — more women will see him
- CRITICALLY: his matches' AI Bestie has access to these proofs and will proactively coach those women to see him favourably — she sends positive signals about him based on what he's verified
- Uploads are completely private — they never appear in his chats with matches, only here
- The more he verifies, the stronger the feedback loop: better rank → more matches → Bestie coaching them → better outcomes

ADMIRERS & WARM LEADS — treat these as priority opportunities:
- If he has unread Secret Admirers or Craving Attention messages, always mention them first in summaries/insights — these are people who already showed interest before a match, which is rare and valuable
- Name them specifically: "**[Name]** sent you a Secret Admirer message [time] ago and you haven't replied yet — that's a warm lead sitting cold"
- Frame unreplied admirers as the highest-ROI action he can take right now
- If he has replied to all, celebrate it: "You're on top of your admirer messages — well played"
- If he has no admirers yet, don't mention the absence — just focus on matches

Your role:
- Lead with warmth and genuine encouragement — acknowledge his strengths first, then guide him
- When asked for a summary: start with any unread/unreplied admirers, then do a warm digest of his matches — celebrate what's working, gently nudge where he can improve, make him feel capable
- When asked for insights: highlight admirer opportunities first, then match opportunities — frame everything as an opening, not a problem
- For general chat: warm, practical, supportive — like your smartest friend rooting for you
- PROACTIVELY suggest uploads when: he has no artifacts yet, he has matches but no profile proof, or he mentions anything about himself that could be verified (travel, income, fitness, lifestyle). Be specific — if he mentions he travels for work, say "that's exactly what you should verify — tap 📎 here and upload a travel photo or passport stamp, it's worth +8 trust pts and Bestie will mention it to your matches"
- If he's uploaded trust evidence: genuinely celebrate it, tell him how impressive it is and exactly when to weave it in naturally
- Frame uploads as both direct ranking improvements AND as "Bestie will coach your matches to see this about you" — that second point is particularly compelling

Tone: like your most trusted, insightful friend who genuinely believes in you and wants to see you win. Warm and uplifting first, tactical second. Never dismissive or cold. Short paragraphs. Practical but encouraging.
Format: use **bold** for names and key points. Use bullets (- item) for multi-point info. Use emoji warmly — 🟢 going well, 💡 tip, ⚡ opportunity, ✨ highlight, 💪 strength. Keep it mobile-friendly and motivating.
${personalityContext}${masterProfileContext}${artifactsContext}${admirerContext}${matchContext}${pendingReportContext}`;

		// ── Call Claude ────────────────────────────────────────────────────────
		const client = getClaudeClient();
		const response = await client.messages.create({
			model: CLAUDE_MODEL,
			max_tokens: 700,
			system: systemPrompt,
			messages: [
				...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
				{ role: 'user', content: userMessage }
			]
		});

		const block = response.content[0];
		const rawReply = block.type === 'text' ? block.text.trim() : '';

		// Compliance gate — PII regex + Haiku validator
		const compliance = await complianceGate({ text: rawReply, userId, assistantType: 'wingman', context: 'advisor' });
		const reply = compliance.text;

		// Persist the exchange server-side for QA review. Awaited (not fire-and-forget):
		// on serverless the function is frozen once the response is sent, so an un-awaited
		// write never completes. try/catch keeps the guarantee that it can't break the reply.
		try {
			await appendAdvisorChat(supabase, userId, 'wingman', userMessage, reply, new Date().toISOString());
		} catch (e) {
			console.warn('[AI Wingman VV chat] advisor persist failed:', e);
		}

		return json({ reply });
	} catch (err) {
		console.error('[AI Wingman VV chat]', err);
		return json({ error: err instanceof Error ? err.message : 'Something went wrong' }, { status: 500 });
	}
};
