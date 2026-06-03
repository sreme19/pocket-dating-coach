// ============================================================
// voice-call-context.ts — assembles the AI Bestie system prompt for a LIVE
// voice call with a match, on the female owner's behalf.
//
// This is the voice sibling of bestie-responder.ts's context gathering: it pulls
// the SAME real grounding (her preferences, his verified proofs, who each person
// is, recent thread history) so the spoken bestie has full parity with the text
// bestie — only the output shape differs (a streamed spoken system prompt vs a
// coaching-JSON turn). Read-only; performs no writes.
// ============================================================

import { getSupabase } from './supabase';
import { loadPreferences } from './profile-service';
import type { PreferencesProfile } from './profile-service';
import { buildBestieVoiceSystemPrompt } from '$lib/prompts';

export interface VoiceCallContext {
	/** The female owner the bestie speaks for. */
	ownerName: string;
	/** The match on the call. */
	matchName: string;
	/** Fully-assembled spoken system prompt, ready for the voice worker's LLM. */
	systemPrompt: string;
	/** Compact recent-thread transcript, so the call doesn't repeat the text chat. */
	priorThread: string;
}

function formatStructuredPreferences(prefs: PreferencesProfile): string {
	const lines: string[] = [];
	if (prefs.emotionalSignals.length) lines.push(`- Emotional signals she values: ${prefs.emotionalSignals.join(', ')}`);
	if (prefs.lifestyleSignals.length) lines.push(`- Lifestyle signals she values: ${prefs.lifestyleSignals.join(', ')}`);
	if (prefs.maturitySignals.length) lines.push(`- Maturity signals she values: ${prefs.maturitySignals.join(', ')}`);
	if (prefs.boundaries.length) lines.push(`- Her firm boundaries: ${prefs.boundaries.join(', ')}`);
	if (prefs.dealbreakers.length) lines.push(`- Her dealbreakers (absolute no-gos): ${prefs.dealbreakers.join(', ')}`);
	if (prefs.privateCompatibilityNotes.length) lines.push(`- Private notes: ${prefs.privateCompatibilityNotes.join(', ')}`);
	return lines.length ? `\n\nWhat you know about ${'her'}:\n${lines.join('\n')}` : '';
}

/**
 * Build the full context + spoken system prompt for a bestie voice call.
 *
 * @param ownerId       the female owner whose bestie is on the call
 * @param matchId       the match/conversation id (verified_vibe_matches.id)
 * @param usingClonedVoice whether the call will use her real cloned voice
 */
export async function loadVoiceCallContext(
	ownerId: string,
	matchId: string,
	usingClonedVoice: boolean
): Promise<VoiceCallContext> {
	const supabase = getSupabase();

	const [owner, matchRow, structuredPrefs, recent] = await Promise.all([
		supabase
			.from('verified_vibe_users')
			.select('first_name, preferences, about, looking')
			.eq('id', ownerId)
			.single()
			.then((r) => r.data),
		supabase
			.from('verified_vibe_matches')
			.select('user1_id, user2_id')
			.eq('id', matchId)
			.single()
			.then((r) => r.data),
		loadPreferences(ownerId).catch(() => null),
		supabase
			.from('verified_vibe_messages')
			.select('content, sender_id, created_at')
			.eq('match_id', matchId)
			.order('created_at', { ascending: false })
			.limit(12)
			.then((r) => r.data)
	]);

	const ownerName: string = (owner as any)?.first_name || 'her';

	let matchName = 'him';
	let matchArtifactContext = '';
	if (matchRow) {
		const otherUserId = matchRow.user1_id === ownerId ? matchRow.user2_id : matchRow.user1_id;
		const [otherUser, artifacts] = await Promise.all([
			supabase
				.from('verified_vibe_users')
				.select('first_name')
				.eq('id', otherUserId)
				.single()
				.then((r) => r.data),
			(supabase as any)
				.from('user_artifacts')
				.select('claim_tag, trust_points')
				.eq('user_id', otherUserId)
				.then((r: any) => r.data)
				.catch(() => null)
		]);
		matchName = (otherUser as any)?.first_name || 'him';

		if (artifacts?.length) {
			const tagCounts: Record<string, number> = {};
			for (const a of artifacts) tagCounts[a.claim_tag] = (tagCounts[a.claim_tag] ?? 0) + 1;
			const parts = Object.entries(tagCounts).map(([tag, c]) => `${tag}${c > 1 ? ` (x${c})` : ''}`);
			matchArtifactContext = `\n\n${matchName} has uploaded verified lifestyle proofs: ${parts.join(', ')}. He's taken real steps to back up his profile — acknowledge it warmly if it comes up naturally.`;
		}
	}

	// Owner profile + structured preferences context block.
	let contextBlock = '';
	if (owner) {
		const aboutText = (owner as any).about ? `\n\nAbout ${ownerName}: ${(owner as any).about}` : '';
		const lookingText = (owner as any).looking ? `\nWhat ${ownerName} is looking for: ${(owner as any).looking}` : '';
		contextBlock += aboutText + lookingText;
	}
	if (structuredPrefs) {
		const block = formatStructuredPreferences(structuredPrefs).replace(/\bher\b/, ownerName);
		contextBlock += block;
	}
	contextBlock += matchArtifactContext;

	// Compact prior-thread transcript so the spoken call builds on the text chat
	// instead of re-treading it.
	const msgs = (recent ?? []).slice().reverse();
	let priorThread = '';
	if (msgs.length) {
		const lines = msgs.map(
			(m: any) => `${m.sender_id === ownerId ? `${ownerName} (or her bestie)` : matchName}: ${m.content}`
		);
		priorThread = lines.join('\n');
		contextBlock += `\n\nTHEIR TEXT CHAT SO FAR (do not repeat questions already answered here; build on it):\n${priorThread}`;
	}

	const systemPrompt = buildBestieVoiceSystemPrompt({
		userName: ownerName,
		matchName,
		contextBlock,
		usingClonedVoice
	});

	return { ownerName, matchName, systemPrompt, priorThread };
}
