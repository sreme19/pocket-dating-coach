/**
 * Advisor (global) chat persistence.
 *
 * The global AI Wingman / AI Bestie advisor chat ("Your match advisor") keeps its
 * transcript in the browser's localStorage for the user's own experience. To make
 * those exchanges reviewable in the QA console we also persist a canonical,
 * append-only copy server-side in ai_assistant_advisor_chats (one row per
 * user + assistant). This is best-effort: a write failure must never break the
 * chat response, so callers fire-and-forget.
 */

import type { getSupabase } from '$lib/server/supabase';

type SB = ReturnType<typeof getSupabase>;

export type AdvisorRole = 'user' | 'assistant';
export interface AdvisorChatMessage {
	role: AdvisorRole;
	content: string;
	ts: string; // ISO-8601
}

/**
 * Append one user turn and the AI reply to the user's advisor transcript.
 * Read-modify-write upsert — advisor chats are single-threaded per user so
 * concurrent turns are unlikely, and a rare lost append is acceptable for QA.
 */
export async function appendAdvisorChat(
	sb: SB,
	userId: string,
	assistantType: 'wingman' | 'bestie',
	userMessage: string,
	reply: string,
	now: string
): Promise<void> {
	if (!userId || (!userMessage && !reply)) return;

	const { data: existing } = await sb
		.from('ai_assistant_advisor_chats')
		.select('id, messages')
		.eq('user_id', userId)
		.eq('assistant_type', assistantType)
		.maybeSingle();

	const prior: AdvisorChatMessage[] = Array.isArray((existing as { messages?: unknown } | null)?.messages)
		? ((existing as { messages: AdvisorChatMessage[] }).messages)
		: [];

	const appended: AdvisorChatMessage[] = [...prior];
	if (userMessage) appended.push({ role: 'user', content: userMessage, ts: now });
	if (reply) appended.push({ role: 'assistant', content: reply, ts: now });

	await sb.from('ai_assistant_advisor_chats').upsert(
		{
			user_id: userId,
			assistant_type: assistantType,
			messages: appended,
			updated_at: now
		} as never,
		{ onConflict: 'user_id,assistant_type' }
	);
}
