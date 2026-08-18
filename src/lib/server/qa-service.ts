/**
 * QA service — assembles AI interactions for manual review and persists verdicts.
 *
 * The unit of review is a MATCH thread. For each match we surface:
 *   - both profile owners (first name + light context),
 *   - the full message thread (verified_vibe_messages), with AI-sent messages
 *     flagged (is_ai) and the AI Bestie's coaching signal/read shown inline,
 *   - any AI coaching conversations tied to the match (ai_assistant_conversations),
 *   - the owners' thumbs feedback on AI replies (ai_bestie_feedback),
 *   - where the Bestie → woman HAND-OFF stands (see HandoffState): without it a
 *     reviewer reads a transcript blind to whether a waiting man is inside a live
 *     48h window, already expired, or being strung along.
 *
 * All access is server-side via the service-role client.
 */

import type { getSupabase } from '$lib/server/supabase';
import { RUBRIC, type RubricKey } from '$lib/qa-rubric';
import { computeHandoffClock, HANDOFF_TIMEOUT_HOURS } from '$lib/server/handoff-clock';

export { HANDOFF_TIMEOUT_HOURS };

type SB = ReturnType<typeof getSupabase>;

export { RUBRIC, type RubricKey };

export interface ReviewRecord {
	id: string;
	match_id: string | null;
	advisor_chat_id: string | null;
	voice_call_id: string | null;
	reviewer: string;
	score_accuracy: number | null;
	score_tone: number | null;
	score_safety: number | null;
	score_helpfulness: number | null;
	flagged_message_ids: FlaggedMessage[];
	comments: string | null;
	status: string;
	created_at: string;
	updated_at: string;
}

/** A flagged message and the reviewer's note about it. */
export interface FlaggedMessage {
	id: string;
	note: string;
}

/** Accepts legacy string[] or {id,note}[] from JSONB and normalizes. */
export function normalizeFlags(raw: unknown): FlaggedMessage[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.map((f) => {
			if (typeof f === 'string') return { id: f, note: '' };
			if (f && typeof f === 'object' && 'id' in f) {
				const o = f as { id: unknown; note?: unknown };
				return { id: String(o.id), note: typeof o.note === 'string' ? o.note : '' };
			}
			return null;
		})
		.filter((x): x is FlaggedMessage => x !== null);
}

interface Participant {
	id: string;
	name: string;
	gender: string | null;
	archetype: string | null;
	age?: number | null;
	city?: string | null;
	about?: string | null;
}

export interface QueueRow {
	kind: 'match' | 'advisor' | 'voice';
	/** Match id, or — for advisor rows — the advisor chat id. Stable list key. */
	matchId: string;
	/** Detail-page route for this row. */
	href: string;
	status: string;
	createdAt: string;
	lastActivityAt: string | null;
	participantA: Participant;
	participantB: Participant;
	counts: { messages: number; aiMessages: number; coached: number; coachingThreads: number };
	hasAi: boolean;
	review: {
		exists: boolean;
		status: string | null;
		reviewer: string | null;
		updatedAt: string | null;
		avgScore: number | null;
	} | null;
}

export interface ThreadMessage {
	id: string;
	senderId: string;
	senderLabel: string;
	isAi: boolean;
	content: string;
	aiSignal: string | null;
	aiRead: string | null;
	createdAt: string;
}

export interface CoachingThread {
	id: string;
	assistantType: 'bestie' | 'wingman';
	ownerName: string;
	messages: { role: string; content: string; citations?: string[]; timestamp?: number }[];
}

export interface FeedbackItem {
	id: string;
	ownerName: string;
	assistantType: string;
	feedbackType: string;
	messageContent: string | null;
	reasonChip: string | null;
	feedbackText: string | null;
	createdAt: string;
}

/**
 * Where the Bestie → woman HAND-OFF stands for this match. The QA console used to
 * show a transcript with no indication that a hand-off was mid-flight, so a reviewer
 * couldn't tell whether a man asking "is she joining?" was being answered honestly
 * or left hanging. All of it is read-only conversational state.
 */
export interface HandoffState {
	/** 'none' = Bestie still vetting (or no checklist), 'held' = proof gate holding the wrap. */
	phase: 'none' | 'active' | 'held' | 'wrapped' | 'expired';
	itemsDone: number;
	itemsTotal: number;
	wrappedAt: string | null;
	/** Whole hours since the hand-off, and left in the 48h window. Null before wrap. */
	elapsedHours: number | null;
	remainingHours: number | null;
	expiresAt: string | null;
	/** 0 = none sent, 1/2/3 = ladder progress (see the handoff-timeout cron). */
	nudgeStage: number;
	/** Is Bestie still speaking for her? Flips false the moment she replies herself. */
	bestieActive: boolean;
	/** Has she opened his thread since the hand-off? The tell for "notified but never saw it". */
	ownerReadSinceHandoff: boolean | null;
	ownerLastReadAt: string | null;
	/** Can she be reached by push at all? False → nudges are invisible without the email fallback. */
	ownerHasPush: boolean;
	proofRequest: Record<string, unknown> | null;
	expiredAt: string | null;
	replacedByMatchId: string | null;
}

export interface MatchReview {
	matchId: string;
	status: string;
	createdAt: string;
	participantA: Participant;
	participantB: Participant;
	messages: ThreadMessage[];
	coachingThreads: CoachingThread[];
	feedback: FeedbackItem[];
	handoff: HandoffState;
	existingReview: ReviewRecord | null;
}

/** One turn in the advisor timeline — a free-form chat message or a proactive greeting. */
export interface AdvisorTimelineItem {
	id: string; // stable synthetic id, used for per-message flagging
	source: 'chat' | 'greeting';
	role: 'user' | 'assistant';
	content: string;
	createdAt: string;
	greetingMode?: number | null;
	topicTags?: string[];
}

/** Owner's thumbs feedback on a proactive greeting. */
export interface AdvisorFeedbackItem {
	id: string;
	rating: number; // 1 = up, -1 = down
	reasonChip: string | null;
	feedbackText: string | null;
	greetingId: string | null;
	createdAt: string;
}

export interface AdvisorReview {
	chatId: string;
	assistantType: 'wingman' | 'bestie';
	assistantLabel: string; // 'AI Wingman' | 'AI Bestie'
	owner: Participant;
	timeline: AdvisorTimelineItem[];
	feedback: AdvisorFeedbackItem[];
	existingReview: ReviewRecord | null;
}

function avg(nums: (number | null)[]): number | null {
	// 0 = N/A — a deliberate "not applicable", excluded from the average like null.
	const vals = nums.filter((n): n is number => typeof n === 'number' && n >= 1);
	if (!vals.length) return null;
	return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

function asParticipant(u: Record<string, unknown> | undefined, id: string): Participant {
	if (!u) return { id, name: 'Unknown', gender: null, archetype: null };
	return {
		id,
		name: (u.first_name as string) ?? 'Unknown',
		gender: (u.gender as string) ?? null,
		archetype: (u.archetype as string) ?? null,
		age: (u.age as number) ?? null,
		city: (u.city as string) ?? null,
		about: (u.about as string) ?? null
	};
}

/**
 * PostgREST caps an unranged `.select()` at 1000 rows. verified_vibe_messages
 * alone is well past that, so the plain queries this function used to run
 * silently truncated — a match whose messages fell past row 1000 read as
 * having none: hasAi false, 0 messages, lastActivityAt null, sorted to the
 * bottom (or dropped entirely by the "AI activity only" filter). Paging with
 * `.range()` until a page comes back short is the fix, ordered by a stable
 * column so page N+1 can't overlap or skip rows relative to page N.
 */
async function fetchAllRows<T>(
	page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
	const PAGE_SIZE = 1000;
	const out: T[] = [];
	for (let from = 0; ; from += PAGE_SIZE) {
		const { data, error } = await page(from, from + PAGE_SIZE - 1);
		if (error) {
			console.warn('[qa-service] paged fetch failed —', error.message);
			break;
		}
		const rows = data ?? [];
		out.push(...rows);
		if (rows.length < PAGE_SIZE) break;
	}
	return out;
}

/** Build the review queue: match threads with AI activity, plus advisor chats. */
export async function listReviewQueue(sb: SB): Promise<QueueRow[]> {
	const db = sb as unknown as { from: (t: string) => any };
	const [matches, messages, users, reviews, convos, advisorChats, voiceCalls] = await Promise.all([
		fetchAllRows<any>((from, to) =>
			db.from('verified_vibe_matches').select('id, user1_id, user2_id, status, created_at').order('id').range(from, to)
		),
		fetchAllRows<any>((from, to) =>
			db
				.from('verified_vibe_messages')
				.select('match_id, sender_id, is_ai, ai_signal, created_at')
				.order('id')
				.range(from, to)
		),
		fetchAllRows<any>((from, to) => db.from('verified_vibe_users').select('id, first_name, gender, archetype').order('id').range(from, to)),
		fetchAllRows<any>((from, to) => db.from('ai_qa_reviews').select('*').order('updated_at', { ascending: false }).order('id').range(from, to)),
		fetchAllRows<any>((from, to) =>
			db.from('ai_assistant_conversations').select('id, match_conversation_id').order('id').range(from, to)
		),
		fetchAllRows<any>((from, to) =>
			db
				.from('ai_assistant_advisor_chats')
				.select('id, user_id, assistant_type, messages, updated_at, created_at')
				.order('id')
				.range(from, to)
		),
		fetchAllRows<any>((from, to) =>
			db
				.from('vv_voice_calls')
				.select('id, owner_user_id, caller_user_id, status, duration_s, transcript, used_cloned_voice, started_at')
				.order('started_at', { ascending: false })
				.order('id')
				.range(from, to)
		)
	]);

	const userById = new Map((users ?? []).map((u) => [u.id, u as Record<string, unknown>]));

	// Aggregate message stats per match.
	const stats = new Map<string, { messages: number; aiMessages: number; coached: number; last: string | null }>();
	for (const m of messages ?? []) {
		const s = stats.get(m.match_id) ?? { messages: 0, aiMessages: 0, coached: 0, last: null };
		s.messages++;
		if ((m as { is_ai?: boolean }).is_ai) s.aiMessages++;
		if ((m as { ai_signal?: string | null }).ai_signal) s.coached++;
		if (!s.last || m.created_at > s.last) s.last = m.created_at;
		stats.set(m.match_id, s);
	}

	const threadsByMatch = new Map<string, number>();
	for (const c of convos ?? []) {
		const k = (c as { match_conversation_id: string }).match_conversation_id;
		threadsByMatch.set(k, (threadsByMatch.get(k) ?? 0) + 1);
	}

	// Latest review per target (reviews already sorted desc by updated_at).
	const latestByMatch = new Map<string, ReviewRecord>();
	const latestByAdvisor = new Map<string, ReviewRecord>();
	const latestByVoice = new Map<string, ReviewRecord>();
	for (const r of (reviews ?? []) as ReviewRecord[]) {
		if (r.match_id && !latestByMatch.has(r.match_id)) latestByMatch.set(r.match_id, r);
		if (r.advisor_chat_id && !latestByAdvisor.has(r.advisor_chat_id)) latestByAdvisor.set(r.advisor_chat_id, r);
		if (r.voice_call_id && !latestByVoice.has(r.voice_call_id)) latestByVoice.set(r.voice_call_id, r);
	}

	const toReviewSummary = (r: ReviewRecord | null): QueueRow['review'] =>
		r
			? {
					exists: true,
					status: r.status,
					reviewer: r.reviewer,
					updatedAt: r.updated_at,
					avgScore: avg([r.score_accuracy, r.score_tone, r.score_safety, r.score_helpfulness])
				}
			: null;

	const rows: QueueRow[] = (matches ?? []).map((m) => {
		const s = stats.get(m.id) ?? { messages: 0, aiMessages: 0, coached: 0, last: null };
		const coachingThreads = threadsByMatch.get(m.id) ?? 0;
		return {
			kind: 'match' as const,
			matchId: m.id,
			href: `/admin/qa/${m.id}`,
			status: m.status,
			createdAt: m.created_at,
			lastActivityAt: s.last,
			participantA: asParticipant(userById.get(m.user1_id), m.user1_id),
			participantB: asParticipant(userById.get(m.user2_id), m.user2_id),
			counts: { messages: s.messages, aiMessages: s.aiMessages, coached: s.coached, coachingThreads },
			hasAi: s.aiMessages > 0 || s.coached > 0 || coachingThreads > 0,
			review: toReviewSummary(latestByMatch.get(m.id) ?? null)
		};
	});

	// Advisor chats (global AI Wingman / AI Bestie ↔ owner) — one row per persisted chat.
	for (const c of advisorChats ?? []) {
		const chat = c as Record<string, unknown>;
		const msgs = Array.isArray(chat.messages) ? (chat.messages as { role?: string; ts?: string }[]) : [];
		const aiMessages = msgs.filter((mm) => mm.role === 'assistant').length;
		const lastTs = msgs.reduce<string | null>((acc, mm) => (mm.ts && (!acc || mm.ts > acc) ? mm.ts : acc), null);
		const assistantType = (chat.assistant_type as 'wingman' | 'bestie') ?? 'wingman';
		const label = assistantType === 'bestie' ? 'AI Bestie' : 'AI Wingman';
		const owner = asParticipant(userById.get(chat.user_id as string), chat.user_id as string);
		rows.push({
			kind: 'advisor' as const,
			matchId: chat.id as string,
			href: `/admin/qa/advisor/${chat.id as string}`,
			status: 'advisor',
			createdAt: (chat.created_at as string) ?? (lastTs ?? ''),
			lastActivityAt: lastTs ?? ((chat.updated_at as string) ?? null),
			participantA: { id: `advisor-${assistantType}`, name: label, gender: null, archetype: assistantType + ' advisor' },
			participantB: owner,
			counts: { messages: msgs.length, aiMessages, coached: 0, coachingThreads: 0 },
			hasAi: aiMessages > 0,
			review: toReviewSummary(latestByAdvisor.get(chat.id as string) ?? null)
		});
	}

	// Voice calls (AI Bestie ↔ male match) — one row per call.
	for (const c of voiceCalls) {
		const turns = Array.isArray(c.transcript) ? (c.transcript as unknown[]) : [];
		const owner = asParticipant(userById.get(c.owner_user_id as string), c.owner_user_id as string);
		const caller = asParticipant(userById.get(c.caller_user_id as string), c.caller_user_id as string);
		const dur = (c.duration_s as number) ?? null;
		rows.push({
			kind: 'voice' as const,
			matchId: c.id as string,
			href: `/admin/qa/voice/${c.id as string}`,
			status: (c.status as string) ?? 'voice',
			createdAt: (c.started_at as string) ?? '',
			lastActivityAt: (c.started_at as string) ?? null,
			participantA: {
				id: 'voice-bestie',
				name: `${owner.name}'s bestie${c.used_cloned_voice ? ' (cloned voice)' : ''}`,
				gender: null,
				archetype: dur != null ? `voice call · ${dur}s` : 'voice call'
			},
			participantB: caller,
			counts: { messages: turns.length, aiMessages: 0, coached: 0, coachingThreads: 0 },
			hasAi: turns.length > 0,
			review: toReviewSummary(latestByVoice.get(c.id as string) ?? null)
		});
	}

	// Unreviewed first, then most recent activity first.
	rows.sort((a, b) => {
		const ar = a.review ? 1 : 0;
		const br = b.review ? 1 : 0;
		if (ar !== br) return ar - br;
		return (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? '');
	});

	return rows;
}

/** Full reconstruction of one match's AI interaction for the detail view. */
/**
 * Reconstruct the hand-off picture for the QA console. Read-only; every field is
 * either already on the match row or one cheap lookup (her push tokens). Degrades
 * to a 'none' phase on a match that never got a checklist.
 */
async function buildHandoffState(
	sb: SB,
	match: Record<string, unknown>,
	a: Participant,
	b: Participant
): Promise<HandoffState> {
	const checklist = (match.bestie_checklist ?? null) as {
		items?: { status?: string }[];
		status?: string;
		wrapped_at?: string | null;
		hold?: boolean;
	} | null;

	const items = Array.isArray(checklist?.items) ? checklist!.items! : [];
	const wrappedAt = checklist?.wrapped_at ?? null;
	const clock = computeHandoffClock(wrappedAt);

	// Bestie's owner = the woman. Her last-read column tells us whether she ever
	// actually LOOKED at the thread after being told it was her turn.
	const woman = a.gender === 'woman' ? a : b.gender === 'woman' ? b : null;
	const ownerLastReadAt = woman
		? ((woman.id === match.user1_id ? match.user1_last_read_at : match.user2_last_read_at) as
				| string
				| null) ?? null
		: null;

	let ownerHasPush = false;
	if (woman) {
		try {
			const { data } = await sb.from('device_tokens').select('token').eq('user_id', woman.id).limit(1);
			ownerHasPush = Array.isArray(data) && data.length > 0;
		} catch {
			ownerHasPush = false;
		}
	}

	const phase: HandoffState['phase'] =
		match.status === 'expired'
			? 'expired'
			: !checklist
				? 'none'
				: checklist.status === 'wrapped'
					? 'wrapped'
					: checklist.hold === true
						? 'held'
						: 'active';

	return {
		phase,
		itemsDone: items.filter((i) => i?.status === 'done').length,
		itemsTotal: items.length,
		wrappedAt,
		elapsedHours: clock?.elapsedHours ?? null,
		remainingHours: clock?.remainingHours ?? null,
		expiresAt: clock?.expiresAt ?? null,
		nudgeStage: Number(match.handoff_nudge_stage ?? 0) || 0,
		bestieActive: match.ai_bestie_active !== false,
		ownerReadSinceHandoff:
			wrappedAt == null
				? null
				: ownerLastReadAt != null && Date.parse(ownerLastReadAt) >= Date.parse(wrappedAt),
		ownerLastReadAt,
		ownerHasPush,
		proofRequest: (match.proof_request ?? null) as Record<string, unknown> | null,
		expiredAt: (match.expired_at ?? null) as string | null,
		replacedByMatchId: (match.replaced_by_match_id ?? null) as string | null
	};
}

export async function getMatchReview(sb: SB, matchId: string): Promise<MatchReview | null> {
	const { data: match } = await sb
		.from('verified_vibe_matches')
		// Single string literal, not a concatenation — the typed client resolves column
		// types from the literal and silently degrades to `GenericStringError` otherwise.
		.select('id, user1_id, user2_id, status, created_at, ai_bestie_active, bestie_checklist, proof_request, handoff_nudge_stage, expired_at, replaced_by_match_id, user1_last_read_at, user2_last_read_at')
		.eq('id', matchId)
		.maybeSingle();
	if (!match) return null;

	const [{ data: users }, { data: msgs }, { data: convos }, { data: review }] = await Promise.all([
		sb.from('verified_vibe_users').select('id, first_name, gender, archetype, age, city, about').in('id', [match.user1_id, match.user2_id]),
		sb.from('verified_vibe_messages').select('*').eq('match_id', matchId).order('created_at', { ascending: true }),
		sb.from('ai_assistant_conversations').select('id, user_id, assistant_type, messages').eq('match_conversation_id', matchId),
		sb.from('ai_qa_reviews').select('*').eq('match_id', matchId).order('updated_at', { ascending: false }).limit(1)
	]);

	const userById = new Map((users ?? []).map((u) => [u.id, u as Record<string, unknown>]));
	const a = asParticipant(userById.get(match.user1_id), match.user1_id);
	const b = asParticipant(userById.get(match.user2_id), match.user2_id);
	const nameFor = (id: string) => (id === a.id ? a.name : id === b.id ? b.name : 'Unknown');

	const messages: ThreadMessage[] = (msgs ?? []).map((m) => {
		const row = m as Record<string, unknown>;
		const isAi = Boolean(row.is_ai);
		const senderId = row.sender_id as string;
		return {
			id: row.id as string,
			senderId,
			senderLabel: isAi ? `AI (on behalf of ${nameFor(senderId)})` : nameFor(senderId),
			isAi,
			content: (row.content as string) ?? '',
			aiSignal: (row.ai_signal as string) ?? null,
			aiRead: (row.ai_read as string) ?? null,
			createdAt: row.created_at as string
		};
	});

	const coachingThreads: CoachingThread[] = (convos ?? []).map((c) => {
		const row = c as Record<string, unknown>;
		const raw = Array.isArray(row.messages) ? (row.messages as Record<string, unknown>[]) : [];
		return {
			id: row.id as string,
			assistantType: row.assistant_type as 'bestie' | 'wingman',
			ownerName: nameFor(row.user_id as string),
			messages: raw.map((mm) => ({
				role: (mm.role as string) ?? 'unknown',
				content: (mm.content as string) ?? '',
				citations: (mm.citations as string[]) ?? undefined,
				timestamp: (mm.timestamp as number) ?? undefined
			}))
		};
	});

	// Feedback is keyed by user, not match — show feedback from either participant.
	const { data: fb } = await sb
		.from('ai_bestie_feedback')
		.select('*')
		.in('user_id', [match.user1_id, match.user2_id])
		.order('created_at', { ascending: false });

	const feedback: FeedbackItem[] = (fb ?? []).map((f) => {
		const row = f as Record<string, unknown>;
		return {
			id: row.id as string,
			ownerName: nameFor(row.user_id as string),
			assistantType: (row.assistant_type as string) ?? 'bestie',
			feedbackType: row.feedback_type as string,
			messageContent: (row.message_content as string) ?? null,
			reasonChip: (row.reason_chip as string) ?? null,
			feedbackText: (row.feedback_text as string) ?? null,
			createdAt: row.created_at as string
		};
	});

	const existing = (review ?? [])[0] as ReviewRecord | undefined;
	if (existing) existing.flagged_message_ids = normalizeFlags(existing.flagged_message_ids);

	const handoff = await buildHandoffState(sb, match as Record<string, unknown>, a, b);

	return {
		matchId: match.id,
		status: match.status,
		createdAt: match.created_at,
		participantA: a,
		participantB: b,
		messages,
		coachingThreads,
		feedback,
		handoff,
		existingReview: existing ?? null
	};
}

/** Full reconstruction of one advisor (global) chat for the detail view. */
export async function getAdvisorReview(sb: SB, chatId: string): Promise<AdvisorReview | null> {
	const { data: chat } = await sb
		.from('ai_assistant_advisor_chats')
		.select('id, user_id, assistant_type, messages')
		.eq('id', chatId)
		.maybeSingle();
	if (!chat) return null;

	const assistantType = ((chat as Record<string, unknown>).assistant_type as 'wingman' | 'bestie') ?? 'wingman';
	const userId = (chat as Record<string, unknown>).user_id as string;

	const [{ data: userRow }, { data: greetings }, { data: fb }, { data: review }] = await Promise.all([
		sb.from('verified_vibe_users').select('id, first_name, gender, archetype, age, city, about').eq('id', userId).maybeSingle(),
		sb.from('ai_assistant_greetings').select('id, content, mode, topic_tags, created_at').eq('user_id', userId).eq('assistant_type', assistantType),
		sb.from('ai_assistant_feedback').select('id, rating, reason_chip, feedback_text, greeting_id, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
		sb.from('ai_qa_reviews').select('*').eq('advisor_chat_id', chatId).order('updated_at', { ascending: false }).limit(1)
	]);

	const owner = asParticipant(userRow as Record<string, unknown> | undefined, userId);

	const chatMsgs = Array.isArray((chat as Record<string, unknown>).messages)
		? ((chat as Record<string, unknown>).messages as { role?: string; content?: string; ts?: string }[])
		: [];

	const timeline: AdvisorTimelineItem[] = [];
	chatMsgs.forEach((m, i) => {
		timeline.push({
			id: `chat-${i}`,
			source: 'chat',
			role: m.role === 'assistant' ? 'assistant' : 'user',
			content: m.content ?? '',
			createdAt: m.ts ?? ''
		});
	});
	for (const g of greetings ?? []) {
		const row = g as Record<string, unknown>;
		timeline.push({
			id: `greeting-${row.id as string}`,
			source: 'greeting',
			role: 'assistant',
			content: (row.content as string) ?? '',
			createdAt: (row.created_at as string) ?? '',
			greetingMode: (row.mode as number) ?? null,
			topicTags: (row.topic_tags as string[]) ?? []
		});
	}
	// Chronological — greetings interleave with chat turns by timestamp.
	timeline.sort((x, y) => (x.createdAt ?? '').localeCompare(y.createdAt ?? ''));

	const feedback: AdvisorFeedbackItem[] = (fb ?? []).map((f) => {
		const row = f as Record<string, unknown>;
		return {
			id: row.id as string,
			rating: (row.rating as number) ?? 0,
			reasonChip: (row.reason_chip as string) ?? null,
			feedbackText: (row.feedback_text as string) ?? null,
			greetingId: (row.greeting_id as string) ?? null,
			createdAt: (row.created_at as string) ?? ''
		};
	});

	const existing = (review ?? [])[0] as ReviewRecord | undefined;
	if (existing) existing.flagged_message_ids = normalizeFlags(existing.flagged_message_ids);

	return {
		chatId: chat.id as string,
		assistantType,
		assistantLabel: assistantType === 'bestie' ? 'AI Bestie' : 'AI Wingman',
		owner,
		timeline,
		feedback,
		existingReview: existing ?? null
	};
}

export interface SaveReviewInput {
	/** Provide exactly one target: a match thread, advisor chat, or voice call. */
	matchId?: string;
	advisorChatId?: string;
	voiceCallId?: string;
	reviewer: string;
	scores: Record<RubricKey, number | null>;
	flags: FlaggedMessage[];
	comments: string;
	status: string;
}

export interface VoiceCallTurn {
	id: string; // synthetic stable id (t-<index>) for per-turn flagging
	role: 'agent' | 'caller';
	speaker: string;
	text: string;
	ts: string | null;
}

export interface VoiceCallReview {
	callId: string;
	status: string;
	durationS: number | null;
	usedClonedVoice: boolean;
	ownerName: string;
	callerName: string;
	caller: Participant;
	turns: VoiceCallTurn[];
	recap: string | null;
	signal: string | null;
	read: string | null;
	drafts: string[];
	startedAt: string | null;
	existingReview: ReviewRecord | null;
}

/** Reconstruct one voice call for the QA detail/review view. */
export async function getVoiceCallReview(sb: SB, callId: string): Promise<VoiceCallReview | null> {
	const db = sb as unknown as { from: (t: string) => any };
	const { data: call } = await db
		.from('vv_voice_calls')
		.select(
			'id, owner_user_id, caller_user_id, status, duration_s, used_cloned_voice, transcript, drafts, summary_message_id, started_at'
		)
		.eq('id', callId)
		.maybeSingle();
	if (!call) return null;

	const [{ data: owner }, { data: caller }, { data: summary }, { data: reviewRows }] = await Promise.all([
		sb.from('verified_vibe_users').select('id, first_name, gender, archetype, age, city, about').eq('id', call.owner_user_id).maybeSingle(),
		sb.from('verified_vibe_users').select('id, first_name, gender, archetype, age, city, about').eq('id', call.caller_user_id).maybeSingle(),
		call.summary_message_id
			? sb.from('verified_vibe_messages').select('content, ai_signal, ai_read').eq('id', call.summary_message_id).maybeSingle()
			: Promise.resolve({ data: null }),
		db.from('ai_qa_reviews').select('*').eq('voice_call_id', callId).order('updated_at', { ascending: false }).limit(1)
	]);

	const ownerName = (owner as { first_name?: string } | null)?.first_name ?? 'her';
	const callerName = (caller as { first_name?: string } | null)?.first_name ?? 'him';
	const rawTurns = Array.isArray(call.transcript) ? (call.transcript as Array<Record<string, unknown>>) : [];
	const turns: VoiceCallTurn[] = rawTurns.map((t, i) => {
		const role = (t.role as string) === 'agent' ? 'agent' : 'caller';
		return {
			id: `t-${i}`,
			role,
			speaker: role === 'agent' ? `${ownerName}'s bestie` : callerName,
			text: String(t.text ?? ''),
			ts: (t.ts as string) ?? null
		};
	});
	const draftList = Array.isArray(call.drafts)
		? (call.drafts as Array<Record<string, unknown>>).map((d) => String(d.text ?? '')).filter(Boolean)
		: [];

	return {
		callId,
		status: (call.status as string) ?? 'unknown',
		durationS: (call.duration_s as number) ?? null,
		usedClonedVoice: !!call.used_cloned_voice,
		ownerName,
		callerName,
		caller: asParticipant(caller as Record<string, unknown> | undefined, call.caller_user_id),
		turns,
		recap: (summary as { content?: string } | null)?.content ?? null,
		signal: (summary as { ai_signal?: string } | null)?.ai_signal ?? null,
		read: (summary as { ai_read?: string } | null)?.ai_read ?? null,
		drafts: draftList,
		startedAt: (call.started_at as string) ?? null,
		existingReview: ((reviewRows ?? [])[0] as ReviewRecord) ?? null
	};
}

export async function saveReview(sb: SB, input: SaveReviewInput): Promise<{ error: string | null }> {
	const targets = [input.matchId, input.advisorChatId, input.voiceCallId].filter(Boolean);
	if (targets.length !== 1) {
		return { error: 'A review must target exactly one of a match, advisor chat, or voice call.' };
	}
	const { error } = await sb.from('ai_qa_reviews').insert({
		match_id: input.matchId ?? null,
		advisor_chat_id: input.advisorChatId ?? null,
		voice_call_id: input.voiceCallId ?? null,
		reviewer: input.reviewer,
		score_accuracy: null,
		score_tone: input.scores.tone,
		score_safety: input.scores.safety,
		score_helpfulness: input.scores.helpfulness,
		flagged_message_ids: input.flags,
		comments: input.comments || null,
		status: input.status
	} as never);
	return { error: error?.message ?? null };
}

export interface QaStats {
	totalReviews: number;
	matchesReviewed: number;
	byStatus: Record<string, number>;
	avgByDimension: Record<RubricKey, number | null>;
	byReviewer: { reviewer: string; count: number; avgScore: number | null }[];
	escalations: { href: string; label: string; reviewer: string; comments: string | null; updatedAt: string }[];
}

export async function getQaStats(sb: SB): Promise<QaStats> {
	const { data } = await sb.from('ai_qa_reviews').select('*').order('updated_at', { ascending: false });
	const reviews = (data ?? []) as ReviewRecord[];

	const byStatus: Record<string, number> = {};
	const reviewerAgg = new Map<string, { count: number; scores: number[] }>();
	const escalations: QaStats['escalations'] = [];

	const dimVals: Record<RubricKey, number[]> = { tone: [], safety: [], helpfulness: [] };

	for (const r of reviews) {
		byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
		// Skip N/A (0) and null — only real 1..5 scores feed the dimension averages.
		if (typeof r.score_tone === 'number' && r.score_tone >= 1) dimVals.tone.push(r.score_tone);
		if (typeof r.score_safety === 'number' && r.score_safety >= 1) dimVals.safety.push(r.score_safety);
		if (typeof r.score_helpfulness === 'number' && r.score_helpfulness >= 1) dimVals.helpfulness.push(r.score_helpfulness);

		const ra = reviewerAgg.get(r.reviewer) ?? { count: 0, scores: [] };
		ra.count++;
		const a = avg([r.score_accuracy, r.score_tone, r.score_safety, r.score_helpfulness]);
		if (a !== null) ra.scores.push(a);
		reviewerAgg.set(r.reviewer, ra);

		if (r.status === 'escalated') {
			const href = r.voice_call_id
				? `/admin/qa/voice/${r.voice_call_id}`
				: r.advisor_chat_id
					? `/admin/qa/advisor/${r.advisor_chat_id}`
					: `/admin/qa/${r.match_id}`;
			const label = r.voice_call_id ? 'Voice call' : r.advisor_chat_id ? 'Advisor chat' : 'Match thread';
			escalations.push({ href, label, reviewer: r.reviewer, comments: r.comments, updatedAt: r.updated_at });
		}
	}

	const mean = (arr: number[]) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null);

	return {
		totalReviews: reviews.length,
		matchesReviewed: new Set(reviews.map((r) => r.match_id ?? r.advisor_chat_id ?? r.voice_call_id)).size,
		byStatus,
		avgByDimension: {
			tone: mean(dimVals.tone),
			safety: mean(dimVals.safety),
			helpfulness: mean(dimVals.helpfulness)
		},
		byReviewer: [...reviewerAgg.entries()]
			.map(([reviewer, v]) => ({ reviewer, count: v.count, avgScore: mean(v.scores) }))
			.sort((x, y) => y.count - x.count),
		escalations
	};
}
