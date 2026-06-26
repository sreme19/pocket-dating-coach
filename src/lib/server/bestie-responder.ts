/**
 * Server-side AI Bestie responder.
 *
 * Generates (and optionally sends) a Bestie reply on behalf of a female user in
 * a dating conversation. This runs server-side so it works even when the user's
 * app is closed — triggered when a match sends her a message.
 */
import { getClaudeClient, CLAUDE_MODEL } from '$lib/claude';
import { getSupabase } from '$lib/server/supabase';
import { loadPreferences } from '$lib/server/profile-service';
import type { PreferencesProfile } from '$lib/server/profile-service';
import { buildBestieReplyPrompt, stripBannedDashes } from '$lib/prompts';

export interface BestieReply {
	signal: string;
	read: string;
	reply: string;
}

function formatStructuredPreferences(prefs: PreferencesProfile | null, hardNos: string[] = []): string {
	const p = prefs ?? ({
		emotionalSignals: [], lifestyleSignals: [], maturitySignals: [],
		boundaries: [], dealbreakers: [], privateCompatibilityNotes: [],
	} as unknown as PreferencesProfile);
	const lines: string[] = ['\nHer known preferences:'];
	if (p.emotionalSignals.length > 0) lines.push(`- Emotional signals she values: ${p.emotionalSignals.join(', ')}`);
	if (p.lifestyleSignals.length > 0) lines.push(`- Lifestyle signals she values: ${p.lifestyleSignals.join(', ')}`);
	if (p.maturitySignals.length > 0) lines.push(`- Maturity signals she values: ${p.maturitySignals.join(', ')}`);
	if (p.boundaries.length > 0) lines.push(`- Her firm boundaries: ${p.boundaries.join(', ')}`);
	// Declared hard_nos ∪ ai_assistant_profiles.dealbreakers (AI overlay) — keep both.
	const dealbreakers = Array.from(new Set([...hardNos, ...p.dealbreakers]));
	if (dealbreakers.length > 0) lines.push(`- Her dealbreakers (absolute no-gos): ${dealbreakers.join(', ')}`);
	if (p.privateCompatibilityNotes.length > 0) lines.push(`- Private notes: ${p.privateCompatibilityNotes.join(', ')}`);
	return lines.join('\n');
}

/**
 * Generate a Bestie reply. Fetches preferences, match artifacts, and recent
 * conversation history from the DB. Does NOT send — returns the parsed result.
 *
 * @param userId  the female user (whose voice Bestie writes in)
 * @param matchId the conversation/match id
 * @param lastMessage the message just received from the match
 */
export async function generateBestieReply(
	userId: string,
	matchId: string,
	lastMessage: string,
	timing?: { claudeMs?: number }
): Promise<BestieReply> {
	const supabase = getSupabase();

	// These four reads are independent — run them concurrently rather than in
	// series. Cutting ~4 sequential DB round-trips to one parallel batch is a
	// meaningful chunk of the perceived "Bestie reply" delay.
	const [user, matchRow, structuredPrefs, recent] = await Promise.all([
		supabase
			.from('verified_vibe_users')
			.select('first_name, preferences, about, looking, hard_nos')
			.eq('id', userId)
			.single()
			.then((r) => r.data),
		supabase
			.from('verified_vibe_matches')
			.select('user1_id, user2_id')
			.eq('id', matchId)
			.single()
			.then((r) => r.data),
		loadPreferences(userId).catch(() => null),
		supabase
			.from('verified_vibe_messages')
			.select('content, sender_id, created_at')
			.eq('match_id', matchId)
			.order('created_at', { ascending: false })
			.limit(12)
			.then((r) => r.data),
	]);

	const userName: string = (user as any)?.first_name || 'her';

	// Resolve the match (other user) and their name + artifacts. Both reads
	// depend on otherUserId, so they run in parallel once the match is known.
	let matchName = 'him';
	let maleArtifactContext = '';
	let maleAbout = '';
	let provenTags: string[] = [];
	let otherUserId: string | null = null;
	if (matchRow) {
		otherUserId = matchRow.user1_id === userId ? matchRow.user2_id : matchRow.user1_id;
		const [otherUser, artifacts] = await Promise.all([
			supabase
				.from('verified_vibe_users')
				.select('first_name, about')
				.eq('id', otherUserId)
				.single()
				.then((r) => r.data),
			(supabase as any)
				.from('user_artifacts')
				.select('claim_tag, trust_points')
				.eq('user_id', otherUserId)
				.then((r: any) => r.data)
				.catch(() => null),
		]);
		matchName = otherUser?.first_name || 'him';
		maleAbout = ((otherUser as any)?.about ?? '').toString().slice(0, 240);

		if (artifacts?.length) {
			const tagCounts: Record<string, number> = {};
			for (const a of artifacts) tagCounts[a.claim_tag] = (tagCounts[a.claim_tag] ?? 0) + 1;
			provenTags = Object.entries(tagCounts).map(([tag, count]) => `${tag}${count > 1 ? ` (×${count})` : ''}`);
			maleArtifactContext = `\n\n${matchName} has uploaded verified proofs: ${provenTags.join(', ')}. He's taken intentional steps to back up his profile. Acknowledge this positively when relevant.`;
		}
	}

	// Preferences context
	let preferencesContext = '';
	if (user) {
		const prefs = (user as any).preferences || {};
		const aboutText = (user as any).about ? `\nAbout her: ${(user as any).about}` : '';
		const lookingText = (user as any).looking ? `\nLooking for: ${(user as any).looking}` : '';
		const prefsText = Object.keys(prefs).length > 0 ? `\nHer preferences: ${JSON.stringify(prefs)}` : '';
		preferencesContext = aboutText + lookingText + prefsText;
	}

	const hardNos: string[] = Array.isArray((user as any)?.hard_nos)
		? ((user as any).hard_nos as unknown[]).map((h) => `${h}`.trim()).filter(Boolean)
		: [];
	let structuredPreferencesContext = '';
	const hasStructured = structuredPrefs && (structuredPrefs.emotionalSignals.length > 0 || structuredPrefs.dealbreakers.length > 0 || structuredPrefs.boundaries.length > 0);
	if (hardNos.length > 0 || hasStructured) {
		structuredPreferencesContext = formatStructuredPreferences(structuredPrefs, hardNos);
	}

	// Recent conversation history (last 12 messages)
	let transcript = '';
	const msgs = (recent ?? []).slice().reverse();
	if (msgs.length > 0) {
		const lines = msgs.map((m: any) => `${m.sender_id === userId ? userName : matchName}: ${m.content}`);
		transcript = `\n\nCONVERSATION SO FAR (most recent last) — do NOT repeat questions already asked or re-raise topics already settled:\n${lines.join('\n')}\n`;
	}

	// Is this the FIRST Bestie message in this thread? (No message from her side
	// exists yet — only his opener.) The first turn gets the gap-aware ally opener.
	const isOpener = !(recent ?? []).some((m: any) => m.sender_id === userId);

	// Gap-aware opener context: what she values vs. what he's already shown, so the
	// opener can warmly draw out the ONE thing he hasn't surfaced — never a checklist.
	// Heuristic from data we already have (her valued signals + his proofs + his bio);
	// when the ADVISOR_VECTORS path-plan (pathGaps) is live it can supply a sharper gap.
	let openerContext = '';
	if (isOpener) {
		const valued = structuredPrefs
			? [...structuredPrefs.emotionalSignals, ...structuredPrefs.lifestyleSignals, ...structuredPrefs.maturitySignals]
			: [];
		const valuedLine = valued.length ? valued.join(', ') : '(none recorded yet — open warm and ally-toned with one light question)';
		const provenLine = provenTags.length ? provenTags.join(', ') : 'nothing verified on his profile yet';
		const bioLine = maleAbout || '(no bio yet)';
		openerContext =
			`\n\nOPENER CONTEXT (shapes your first message only — never quote it back verbatim):` +
			`\n- What ${userName} values: ${valuedLine}` +
			`\n- What ${matchName} has already shown/proven: ${provenLine}` +
			`\n- ${matchName}'s bio: ${bioLine}` +
			`\nThe gap to draw out = the ONE thing ${userName} values that ${matchName} hasn't surfaced or proven yet.`;
	}

	const client = getClaudeClient();
	const tClaude = Date.now();
	const message = await client.messages.create({
		model: CLAUDE_MODEL,
		max_tokens: 400,
		messages: [
			{
				role: 'user',
				content: buildBestieReplyPrompt({
					userName,
					matchName,
					contextBlock: `${preferencesContext}${structuredPreferencesContext}${maleArtifactContext}${openerContext}`,
					transcript,
					lastMessage,
					isOpener
				})
			}
		]
	});

	if (timing) timing.claudeMs = Date.now() - tClaude;

	const content = message.content[0];
	if (content.type !== 'text') throw new Error('Unexpected response type from Claude');
	const raw = content.text.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
	// Accept the legacy "suggestedQuestion" key in case a stale prompt or cached
	// model output still produces it.
	const parsed = JSON.parse(raw) as Partial<BestieReply> & { suggestedQuestion?: string };
	return {
		signal: parsed.signal ?? '✅',
		read: stripBannedDashes(parsed.read ?? ''),
		reply: stripBannedDashes(parsed.reply ?? parsed.suggestedQuestion ?? '')
	};
}

/**
 * Generate AND send a Bestie reply server-side: stores the coaching read/signal
 * on the triggering message, then inserts the reply as a message from the user
 * (is_ai = true). Safe to call fire-and-forget.
 *
 * @param userId       the female user Bestie acts for
 * @param matchId      conversation id
 * @param triggerMsgId the match's message that triggered this (to attach coaching)
 * @param lastMessage  text of that message
 */
export async function generateAndSendBestieReply(
	userId: string,
	matchId: string,
	triggerMsgId: string,
	lastMessage: string,
	triggerCreatedAt?: string
): Promise<void> {
	const supabase = getSupabase();
	const timing: { claudeMs?: number } = {};
	const t0 = Date.now();
	const reply = await generateBestieReply(userId, matchId, lastMessage, timing);

	// Attach the coaching card (read/signal) to the triggering message so the
	// female user sees it when she opens the chat.
	try {
		await (supabase as any)
			.from('verified_vibe_messages')
			.update({ ai_signal: reply.signal, ai_read: reply.read })
			.eq('id', triggerMsgId);
	} catch { /* non-critical */ }

	// Send the reply as a message from the user, flagged as AI.
	let replyMessageId: string | null = null;
	let generatedAt: string | null = null;
	if (reply.reply) {
		const { data: inserted } = await (supabase as any)
			.from('verified_vibe_messages')
			.insert({
				match_id: matchId,
				sender_id: userId,
				content: reply.reply,
				is_ai: true
			})
			.select('id, created_at')
			.single();
		replyMessageId = inserted?.id ?? null;
		generatedAt = inserted?.created_at ?? null;
	}

	// Record server-side latency for the AI Latency dashboard. The reply is now
	// in the DB, so generationMs is the full server cost the user waited on
	// (DB reads + Claude + writes). Upsert by reply_message_id so the recipient's
	// client can later merge in the delivery/render stages. Non-fatal.
	if (replyMessageId) {
		try {
			const generationMs = Date.now() - t0;
			const waitedFromUserMsgMs = triggerCreatedAt && generatedAt
				? Math.max(0, new Date(generatedAt).getTime() - new Date(triggerCreatedAt).getTime())
				: null;
			await (supabase as any)
				.from('vv_ai_response_timings')
				.upsert({
					reply_message_id: replyMessageId,
					match_id: matchId,
					response_type: 'bestie',
					trigger_message_id: triggerMsgId,
					trigger_at: triggerCreatedAt ?? null,
					generated_at: generatedAt,
					generation_ms: generationMs,
					claude_ms: timing.claudeMs ?? null,
					waited_from_user_msg_ms: waitedFromUserMsgMs
				}, { onConflict: 'reply_message_id' });
		} catch (e) {
			console.error('[ai-timing] failed to record server timing (non-fatal):', e);
		}
	}
}

/**
 * Proactively send the AI Bestie's FIRST message on a freshly-formed match — the
 * woman's Bestie reaches out to the man BEFORE he says anything ("Bestie speaks
 * first"). Resolves the woman (owner) and man (recipient) from the match, builds
 * the gap-aware opener (the isOpener path in generateBestieReply, with no incoming
 * message), and inserts it as an is_ai message in the woman's voice.
 *
 * Idempotent and non-fatal by design — safe to call fire-and-forget at ANY match-
 * creation site. It no-ops when: Bestie is off on the match, neither side is a
 * woman, or the thread already has a message (so it can never double-open or stomp
 * a conversation that's already started).
 *
 * @param matchId the freshly-created mutual match
 */
export async function generateAndSendBestieOpener(matchId: string): Promise<void> {
	const supabase = getSupabase();
	try {
		const { data: matchRow } = await supabase
			.from('verified_vibe_matches')
			.select('user1_id, user2_id, ai_bestie_active')
			.eq('id', matchId)
			.single();
		if (!matchRow) return;
		// Bestie explicitly off on this match → respect it. (null/undefined = default-on.)
		if ((matchRow as any).ai_bestie_active === false) return;

		// Resolve which side is the woman (Bestie's owner) and which is the man.
		const ids = [matchRow.user1_id, matchRow.user2_id];
		const { data: users } = await supabase
			.from('verified_vibe_users')
			.select('id, gender')
			.in('id', ids);
		const woman = (users ?? []).find((u: any) => u.gender === 'woman');
		const man = (users ?? []).find((u: any) => u.gender === 'man');
		if (!woman || !man) return; // Bestie only proxies woman → man

		// Idempotency: never open a thread that already has any message.
		const { count } = await supabase
			.from('verified_vibe_messages')
			.select('id', { count: 'exact', head: true })
			.eq('match_id', matchId);
		if ((count ?? 0) > 0) return;

		const timing: { claudeMs?: number } = {};
		const t0 = Date.now();
		// Empty lastMessage → generateBestieReply runs the proactive opener path
		// (isOpener is true since no owner-side message exists yet).
		const reply = await generateBestieReply(woman.id, matchId, '', timing);
		if (!reply.reply) return;

		// Re-check right before insert to shrink the double-open race window (e.g. if
		// two creation sites fire for the same match near-simultaneously).
		const { count: count2 } = await supabase
			.from('verified_vibe_messages')
			.select('id', { count: 'exact', head: true })
			.eq('match_id', matchId);
		if ((count2 ?? 0) > 0) return;

		const { data: inserted } = await (supabase as any)
			.from('verified_vibe_messages')
			.insert({ match_id: matchId, sender_id: woman.id, content: reply.reply, is_ai: true })
			.select('id, created_at')
			.single();

		// Best-effort latency record. No trigger message — this is proactive.
		if (inserted?.id) {
			try {
				await (supabase as any)
					.from('vv_ai_response_timings')
					.upsert({
						reply_message_id: inserted.id,
						match_id: matchId,
						response_type: 'bestie',
						generated_at: inserted.created_at ?? null,
						generation_ms: Date.now() - t0,
						claude_ms: timing.claudeMs ?? null
					}, { onConflict: 'reply_message_id' });
			} catch { /* non-critical */ }
		}
	} catch (err) {
		console.error('[bestie-opener] failed (non-fatal):', err);
	}
}
