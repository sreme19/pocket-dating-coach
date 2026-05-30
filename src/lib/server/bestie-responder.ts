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
import { buildBestieReplyPrompt } from '$lib/prompts';

export interface BestieReply {
	signal: string;
	read: string;
	suggestedQuestion: string;
}

function formatStructuredPreferences(prefs: PreferencesProfile): string {
	const lines: string[] = ['\nHer known preferences:'];
	if (prefs.emotionalSignals.length > 0) lines.push(`- Emotional signals she values: ${prefs.emotionalSignals.join(', ')}`);
	if (prefs.lifestyleSignals.length > 0) lines.push(`- Lifestyle signals she values: ${prefs.lifestyleSignals.join(', ')}`);
	if (prefs.maturitySignals.length > 0) lines.push(`- Maturity signals she values: ${prefs.maturitySignals.join(', ')}`);
	if (prefs.boundaries.length > 0) lines.push(`- Her firm boundaries: ${prefs.boundaries.join(', ')}`);
	if (prefs.dealbreakers.length > 0) lines.push(`- Her dealbreakers (absolute no-gos): ${prefs.dealbreakers.join(', ')}`);
	if (prefs.privateCompatibilityNotes.length > 0) lines.push(`- Private notes: ${prefs.privateCompatibilityNotes.join(', ')}`);
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
	lastMessage: string
): Promise<BestieReply> {
	const supabase = getSupabase();

	const { data: user } = await supabase
		.from('verified_vibe_users')
		.select('first_name, preferences, about, looking')
		.eq('id', userId)
		.single();
	const userName: string = (user as any)?.first_name || 'her';

	// Resolve the match (other user) and their name + artifacts
	const { data: matchRow } = await supabase
		.from('verified_vibe_matches')
		.select('user1_id, user2_id')
		.eq('id', matchId)
		.single();

	let matchName = 'him';
	let maleArtifactContext = '';
	let otherUserId: string | null = null;
	if (matchRow) {
		otherUserId = matchRow.user1_id === userId ? matchRow.user2_id : matchRow.user1_id;
		const { data: otherUser } = await supabase
			.from('verified_vibe_users')
			.select('first_name')
			.eq('id', otherUserId)
			.single();
		matchName = otherUser?.first_name || 'him';

		try {
			const { data: artifacts } = await (supabase as any)
				.from('user_artifacts')
				.select('claim_tag, trust_points')
				.eq('user_id', otherUserId);
			if (artifacts?.length) {
				const tagCounts: Record<string, number> = {};
				for (const a of artifacts) tagCounts[a.claim_tag] = (tagCounts[a.claim_tag] ?? 0) + 1;
				const parts = Object.entries(tagCounts).map(([tag, count]) => `${tag}${count > 1 ? ` (×${count})` : ''}`);
				maleArtifactContext = `\n\n${matchName} has uploaded verified proofs: ${parts.join(', ')}. He's taken intentional steps to back up his profile. Acknowledge this positively when relevant.`;
			}
		} catch { /* non-critical */ }
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

	let structuredPreferencesContext = '';
	try {
		const structuredPrefs = await loadPreferences(userId);
		if (structuredPrefs.emotionalSignals.length > 0 || structuredPrefs.dealbreakers.length > 0 || structuredPrefs.boundaries.length > 0) {
			structuredPreferencesContext = formatStructuredPreferences(structuredPrefs);
		}
	} catch { /* non-critical */ }

	// Recent conversation history (last 12 messages)
	let transcript = '';
	try {
		const { data: recent } = await supabase
			.from('verified_vibe_messages')
			.select('content, sender_id, created_at')
			.eq('match_id', matchId)
			.order('created_at', { ascending: false })
			.limit(12);
		const msgs = (recent ?? []).reverse();
		if (msgs.length > 0) {
			const lines = msgs.map((m: any) => `${m.sender_id === userId ? userName : matchName}: ${m.content}`);
			transcript = `\n\nCONVERSATION SO FAR (most recent last) — do NOT repeat questions already asked or re-raise topics already settled:\n${lines.join('\n')}\n`;
		}
	} catch { /* non-critical */ }

	const client = getClaudeClient();
	const message = await client.messages.create({
		model: CLAUDE_MODEL,
		max_tokens: 400,
		messages: [
			{
				role: 'user',
				content: buildBestieReplyPrompt({
					userName,
					matchName,
					contextBlock: `${preferencesContext}${structuredPreferencesContext}${maleArtifactContext}`,
					transcript,
					lastMessage
				})
			}
		]
	});

	const content = message.content[0];
	if (content.type !== 'text') throw new Error('Unexpected response type from Claude');
	const raw = content.text.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
	return JSON.parse(raw) as BestieReply;
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
	lastMessage: string
): Promise<void> {
	const supabase = getSupabase();
	const reply = await generateBestieReply(userId, matchId, lastMessage);

	// Attach the coaching card (read/signal) to the triggering message so the
	// female user sees it when she opens the chat.
	try {
		await (supabase as any)
			.from('verified_vibe_messages')
			.update({ ai_signal: reply.signal, ai_read: reply.read })
			.eq('id', triggerMsgId);
	} catch { /* non-critical */ }

	// Send the reply as a message from the user, flagged as AI.
	if (reply.suggestedQuestion) {
		await (supabase as any)
			.from('verified_vibe_messages')
			.insert({
				match_id: matchId,
				sender_id: userId,
				content: reply.suggestedQuestion,
				is_ai: true
			});
	}
}
