/**
 * QA service — assembles AI interactions for manual review and persists verdicts.
 *
 * The unit of review is a MATCH thread. For each match we surface:
 *   - both profile owners (first name + light context),
 *   - the full message thread (verified_vibe_messages), with AI-sent messages
 *     flagged (is_ai) and the AI Bestie's coaching signal/read shown inline,
 *   - any AI coaching conversations tied to the match (ai_assistant_conversations),
 *   - the owners' thumbs feedback on AI replies (ai_bestie_feedback).
 *
 * All access is server-side via the service-role client.
 */

import type { getSupabase } from '$lib/server/supabase';
import { RUBRIC, type RubricKey } from '$lib/qa-rubric';

type SB = ReturnType<typeof getSupabase>;

export { RUBRIC, type RubricKey };

export interface ReviewRecord {
	id: string;
	match_id: string;
	reviewer: string;
	score_accuracy: number | null;
	score_tone: number | null;
	score_safety: number | null;
	score_helpfulness: number | null;
	flagged_message_ids: string[];
	comments: string | null;
	status: string;
	created_at: string;
	updated_at: string;
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
	matchId: string;
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
	feedbackType: string;
	messageContent: string | null;
	createdAt: string;
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
	existingReview: ReviewRecord | null;
}

function avg(nums: (number | null)[]): number | null {
	const vals = nums.filter((n): n is number => typeof n === 'number');
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

/** Build the review queue across all matches that involve any AI activity. */
export async function listReviewQueue(sb: SB): Promise<QueueRow[]> {
	const [{ data: matches }, { data: messages }, { data: users }, { data: reviews }, { data: convos }] =
		await Promise.all([
			sb.from('verified_vibe_matches').select('id, user1_id, user2_id, status, created_at'),
			sb.from('verified_vibe_messages').select('match_id, sender_id, is_ai, ai_signal, created_at'),
			sb.from('verified_vibe_users').select('id, first_name, gender, archetype'),
			sb.from('ai_qa_reviews').select('*').order('updated_at', { ascending: false }),
			sb.from('ai_assistant_conversations').select('id, match_conversation_id')
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

	// Latest review per match (reviews already sorted desc by updated_at).
	const latestReview = new Map<string, ReviewRecord>();
	for (const r of (reviews ?? []) as ReviewRecord[]) {
		if (!latestReview.has(r.match_id)) latestReview.set(r.match_id, r);
	}

	const rows: QueueRow[] = (matches ?? []).map((m) => {
		const s = stats.get(m.id) ?? { messages: 0, aiMessages: 0, coached: 0, last: null };
		const coachingThreads = threadsByMatch.get(m.id) ?? 0;
		const r = latestReview.get(m.id) ?? null;
		return {
			matchId: m.id,
			status: m.status,
			createdAt: m.created_at,
			lastActivityAt: s.last,
			participantA: asParticipant(userById.get(m.user1_id), m.user1_id),
			participantB: asParticipant(userById.get(m.user2_id), m.user2_id),
			counts: { messages: s.messages, aiMessages: s.aiMessages, coached: s.coached, coachingThreads },
			hasAi: s.aiMessages > 0 || s.coached > 0 || coachingThreads > 0,
			review: r
				? {
						exists: true,
						status: r.status,
						reviewer: r.reviewer,
						updatedAt: r.updated_at,
						avgScore: avg([r.score_accuracy, r.score_tone, r.score_safety, r.score_helpfulness])
					}
				: null
		};
	});

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
export async function getMatchReview(sb: SB, matchId: string): Promise<MatchReview | null> {
	const { data: match } = await sb
		.from('verified_vibe_matches')
		.select('id, user1_id, user2_id, status, created_at')
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
			feedbackType: row.feedback_type as string,
			messageContent: (row.message_content as string) ?? null,
			createdAt: row.created_at as string
		};
	});

	const existing = (review ?? [])[0] as ReviewRecord | undefined;

	return {
		matchId: match.id,
		status: match.status,
		createdAt: match.created_at,
		participantA: a,
		participantB: b,
		messages,
		coachingThreads,
		feedback,
		existingReview: existing ?? null
	};
}

export interface SaveReviewInput {
	matchId: string;
	reviewer: string;
	scores: Record<RubricKey, number | null>;
	flaggedMessageIds: string[];
	comments: string;
	status: string;
}

export async function saveReview(sb: SB, input: SaveReviewInput): Promise<{ error: string | null }> {
	const { error } = await sb.from('ai_qa_reviews').insert({
		match_id: input.matchId,
		reviewer: input.reviewer,
		score_accuracy: input.scores.accuracy,
		score_tone: input.scores.tone,
		score_safety: input.scores.safety,
		score_helpfulness: input.scores.helpfulness,
		flagged_message_ids: input.flaggedMessageIds,
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
	escalations: { matchId: string; reviewer: string; comments: string | null; updatedAt: string }[];
}

export async function getQaStats(sb: SB): Promise<QaStats> {
	const { data } = await sb.from('ai_qa_reviews').select('*').order('updated_at', { ascending: false });
	const reviews = (data ?? []) as ReviewRecord[];

	const byStatus: Record<string, number> = {};
	const reviewerAgg = new Map<string, { count: number; scores: number[] }>();
	const escalations: QaStats['escalations'] = [];

	const dimVals: Record<RubricKey, number[]> = { accuracy: [], tone: [], safety: [], helpfulness: [] };

	for (const r of reviews) {
		byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
		if (typeof r.score_accuracy === 'number') dimVals.accuracy.push(r.score_accuracy);
		if (typeof r.score_tone === 'number') dimVals.tone.push(r.score_tone);
		if (typeof r.score_safety === 'number') dimVals.safety.push(r.score_safety);
		if (typeof r.score_helpfulness === 'number') dimVals.helpfulness.push(r.score_helpfulness);

		const ra = reviewerAgg.get(r.reviewer) ?? { count: 0, scores: [] };
		ra.count++;
		const a = avg([r.score_accuracy, r.score_tone, r.score_safety, r.score_helpfulness]);
		if (a !== null) ra.scores.push(a);
		reviewerAgg.set(r.reviewer, ra);

		if (r.status === 'escalated') {
			escalations.push({ matchId: r.match_id, reviewer: r.reviewer, comments: r.comments, updatedAt: r.updated_at });
		}
	}

	const mean = (arr: number[]) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null);

	return {
		totalReviews: reviews.length,
		matchesReviewed: new Set(reviews.map((r) => r.match_id)).size,
		byStatus,
		avgByDimension: {
			accuracy: mean(dimVals.accuracy),
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
