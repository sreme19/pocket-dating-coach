/**
 * Advisor thread — the owner-facing AI Wingman / AI Bestie coaching conversation.
 *
 * This is the canonical read AND write path for that thread. It replaces the
 * device-local transcript the app used to rely on (SharedPreferences on Flutter,
 * localStorage with a 7-day TTL on web), which meant every coaching reply and
 * every proactive greeting was discarded the moment the screen closed.
 *
 * Rows live in `advisor_messages`, ordered by `seq` — never by `created_at`
 * alone, because the legacy writer stamped a question and its answer with the
 * same timestamp.
 *
 * `ai_assistant_advisor_chats` is still dual-written by `advisor-chat.ts`: the QA
 * console, admin analytics and `ai_qa_reviews.advisor_chat_id`'s foreign key all
 * read it. Migrating those onto rows is deliberate follow-up work.
 */

import type { getSupabase } from '$lib/server/supabase';

type SB = ReturnType<typeof getSupabase>;

export type AssistantType = 'wingman' | 'bestie';
export type AdvisorRole = 'user' | 'assistant';

/**
 * What a turn is, so a client can pick a renderer:
 *  - `chat`        an ordinary exchange
 *  - `greeting`    a proactive insight (carries `greetingId` for thumbs feedback)
 *  - `nudge`       a time-sensitive prompt, e.g. the hand-off deadline
 *  - `task_ack`    "on it, you can close this" — a task was accepted
 *  - `task_result` the finished work
 */
export type AdvisorKind = 'chat' | 'greeting' | 'nudge' | 'task_ack' | 'task_result';

export interface AdvisorMessage {
	id: string;
	role: AdvisorRole;
	kind: AdvisorKind;
	content: string;
	payload: Record<string, unknown> | null;
	greetingId: string | null;
	taskId: string | null;
	createdAt: string;
	seq: number;
}

/** How many turns of history the model sees. Beyond this the thread is summarised. */
export const CLAUDE_HISTORY_TURNS = 12;

/** Hard ceiling on a single thread read, so a long-lived thread can't blow a response. */
const MAX_THREAD_READ = 200;

function rowToMessage(r: Record<string, unknown>): AdvisorMessage {
	return {
		id: String(r.id),
		role: r.role === 'user' ? 'user' : 'assistant',
		kind: (r.kind as AdvisorKind) ?? 'chat',
		content: String(r.content ?? ''),
		payload: (r.payload as Record<string, unknown> | null) ?? null,
		greetingId: (r.greeting_id as string | null) ?? null,
		taskId: (r.task_id as string | null) ?? null,
		createdAt: String(r.created_at),
		seq: Number(r.seq ?? 0)
	};
}

// ── Write ────────────────────────────────────────────────────────────────────

/**
 * Append one turn. Returns the stored message, or null if the write failed —
 * callers on the chat path must degrade to answering without persistence rather
 * than failing the user's request.
 */
export async function appendAdvisorMessage(
	sb: SB,
	opts: {
		userId: string;
		assistantType: AssistantType;
		role: AdvisorRole;
		kind?: AdvisorKind;
		content: string;
		payload?: Record<string, unknown> | null;
		greetingId?: string | null;
		taskId?: string | null;
	}
): Promise<AdvisorMessage | null> {
	const content = (opts.content ?? '').trim();
	if (!opts.userId || !content) return null;

	const { data, error } = await sb
		.from('advisor_messages')
		.insert({
			user_id: opts.userId,
			assistant_type: opts.assistantType,
			role: opts.role,
			kind: opts.kind ?? 'chat',
			content,
			payload: opts.payload ?? null,
			greeting_id: opts.greetingId ?? null,
			task_id: opts.taskId ?? null
		})
		.select('id, role, kind, content, payload, greeting_id, task_id, created_at, seq')
		.single();

	if (error || !data) {
		console.error('[advisor-thread] append failed (non-fatal):', error);
		return null;
	}
	return rowToMessage(data as Record<string, unknown>);
}

/** Append a user turn and its reply together, preserving their order. */
export async function appendAdvisorExchange(
	sb: SB,
	opts: {
		userId: string;
		assistantType: AssistantType;
		userMessage: string;
		reply: string;
		replyPayload?: Record<string, unknown> | null;
	}
): Promise<{ userTurn: AdvisorMessage | null; replyTurn: AdvisorMessage | null }> {
	// Sequential, not parallel: `seq` is assigned at insert time, so racing these
	// two would let the answer sort above its question.
	const userTurn = await appendAdvisorMessage(sb, {
		userId: opts.userId,
		assistantType: opts.assistantType,
		role: 'user',
		content: opts.userMessage
	});
	const replyTurn = await appendAdvisorMessage(sb, {
		userId: opts.userId,
		assistantType: opts.assistantType,
		role: 'assistant',
		content: opts.reply,
		payload: opts.replyPayload ?? null
	});
	return { userTurn, replyTurn };
}

// ── Read ─────────────────────────────────────────────────────────────────────

export async function loadAdvisorThread(
	sb: SB,
	userId: string,
	assistantType: AssistantType,
	opts: { limit?: number } = {}
): Promise<AdvisorMessage[]> {
	const limit = Math.min(opts.limit ?? MAX_THREAD_READ, MAX_THREAD_READ);

	// Newest-first with a limit, then reversed — taking the TAIL of a long thread
	// is what the user wants to see, not its opening.
	const { data, error } = await sb
		.from('advisor_messages')
		.select('id, role, kind, content, payload, greeting_id, task_id, created_at, seq')
		.eq('user_id', userId)
		.eq('assistant_type', assistantType)
		.order('seq', { ascending: false })
		.limit(limit);

	if (error) {
		console.error('[advisor-thread] load failed:', error);
		return [];
	}
	return ((data ?? []) as Record<string, unknown>[]).map(rowToMessage).reverse();
}

/**
 * Recent turns shaped for the Anthropic messages array.
 *
 * Sourcing history server-side also closes a hole: the clients used to POST their
 * own transcript, which the endpoint interpolated into the prompt — a tampered
 * client could rewrite what the assistant "previously said".
 *
 * `task_ack` turns are omitted: "on it, I'll ping you" is UI state, and feeding it
 * back invites the model to re-acknowledge work it already accepted.
 */
export function buildClaudeHistory(
	messages: AdvisorMessage[],
	maxTurns = CLAUDE_HISTORY_TURNS
): Array<{ role: AdvisorRole; content: string }> {
	const usable = messages.filter((m) => m.kind !== 'task_ack' && m.content.trim().length > 0);
	const tail = usable.slice(-maxTurns);

	// Anthropic requires the first message to be a user turn.
	let start = 0;
	while (start < tail.length && tail[start].role !== 'user') start++;

	return tail.slice(start).map((m) => ({ role: m.role, content: m.content }));
}

// ── Read state / unread ──────────────────────────────────────────────────────

export async function getLastReadAt(
	sb: SB,
	userId: string,
	assistantType: AssistantType
): Promise<string | null> {
	const { data } = await sb
		.from('advisor_read_state')
		.select('last_read_at')
		.eq('user_id', userId)
		.eq('assistant_type', assistantType)
		.maybeSingle();
	return (data as { last_read_at?: string } | null)?.last_read_at ?? null;
}

/**
 * Assistant turns the user hasn't seen. Their own turns never count, and a thread
 * with no read state yet is treated as fully unread — a first-time user opening a
 * tab that already has a greeting waiting should see the badge.
 */
export async function countAdvisorUnread(
	sb: SB,
	userId: string,
	assistantType: AssistantType
): Promise<number> {
	const lastReadAt = await getLastReadAt(sb, userId, assistantType);

	let q = sb
		.from('advisor_messages')
		.select('id', { count: 'exact', head: true })
		.eq('user_id', userId)
		.eq('assistant_type', assistantType)
		.eq('role', 'assistant');

	if (lastReadAt) q = q.gt('created_at', lastReadAt);

	const { count, error } = await q;
	if (error) {
		console.error('[advisor-thread] unread count failed:', error);
		return 0;
	}
	return count ?? 0;
}

/** The newest assistant turn, for the chat-list row's live subtitle. */
export async function latestAdvisorHeadline(
	sb: SB,
	userId: string,
	assistantType: AssistantType
): Promise<{ content: string; createdAt: string } | null> {
	const { data } = await sb
		.from('advisor_messages')
		.select('content, created_at')
		.eq('user_id', userId)
		.eq('assistant_type', assistantType)
		.eq('role', 'assistant')
		.order('seq', { ascending: false })
		.limit(1)
		.maybeSingle();

	const row = data as { content?: string; created_at?: string } | null;
	if (!row?.content) return null;
	return { content: row.content, createdAt: String(row.created_at) };
}

export async function markAdvisorRead(
	sb: SB,
	userId: string,
	assistantType: AssistantType,
	at: string = new Date().toISOString()
): Promise<void> {
	const { error } = await sb.from('advisor_read_state').upsert(
		{ user_id: userId, assistant_type: assistantType, last_read_at: at, updated_at: at },
		{ onConflict: 'user_id,assistant_type' }
	);
	if (error) console.error('[advisor-thread] mark read failed (non-fatal):', error);
}

/**
 * The advisor thread is a per-gender surface, so derive which assistant a user
 * owns rather than trusting a client-supplied value — otherwise a man could ask
 * for, and read, a bestie thread.
 */
export async function resolveAssistantType(sb: SB, userId: string): Promise<AssistantType> {
	const { data } = await sb
		.from('verified_vibe_users')
		.select('gender')
		.eq('id', userId)
		.maybeSingle();
	return (data as { gender?: string } | null)?.gender === 'woman' ? 'bestie' : 'wingman';
}

