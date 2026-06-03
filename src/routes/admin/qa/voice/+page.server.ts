import type { PageServerLoad } from './$types';
import { getSupabase } from '$lib/server/supabase';

export interface VoiceCallRow {
	id: string;
	matchId: string;
	status: string;
	ownerName: string;
	callerName: string;
	usedClonedVoice: boolean;
	durationS: number | null;
	startedAt: string;
	endedAt: string | null;
	failureReason: string | null;
	turnCount: number;
	draftCount: number;
	// Recap message dropped into the thread (+ the private owner read).
	recap: string | null;
	signal: string | null;
	read: string | null;
	transcript: Array<{ role: string; text: string; ts?: string }>;
	drafts: Array<{ text: string; ts?: string }>;
}

/**
 * Read-only QA surface for AI Bestie voice calls. Lists recent calls with their
 * transcript, the recap posted to the thread, the private owner read, and any
 * drafts the bestie left — so reviewers can audit voice calls the same way they
 * audit text threads. (Scoring voice calls in ai_qa_reviews needs a follow-up
 * migration to add a voice_call_id target; this view is observe-only for now.)
 */
export const load: PageServerLoad = async () => {
	const sb = getSupabase() as any;

	const { data: calls } = await sb
		.from('vv_voice_calls')
		.select(
			'id, match_id, status, owner_user_id, caller_user_id, used_cloned_voice, duration_s, started_at, ended_at, failure_reason, transcript, drafts, summary_message_id'
		)
		.order('started_at', { ascending: false })
		.limit(100);

	if (!calls?.length) return { calls: [] as VoiceCallRow[] };

	const userIds = new Set<string>();
	const summaryIds: string[] = [];
	for (const c of calls) {
		userIds.add(c.owner_user_id);
		userIds.add(c.caller_user_id);
		if (c.summary_message_id) summaryIds.push(c.summary_message_id);
	}

	const [{ data: users }, { data: summaries }] = await Promise.all([
		sb.from('verified_vibe_users').select('id, first_name').in('id', [...userIds]),
		summaryIds.length
			? sb.from('verified_vibe_messages').select('id, content, ai_signal, ai_read').in('id', summaryIds)
			: Promise.resolve({ data: [] })
	]);

	const nameById = new Map<string, string>((users ?? []).map((u: any) => [u.id, u.first_name]));
	const summaryById = new Map<string, any>((summaries ?? []).map((m: any) => [m.id, m]));

	const rows: VoiceCallRow[] = calls.map((c: any) => {
		const summary = c.summary_message_id ? summaryById.get(c.summary_message_id) : null;
		const transcript = Array.isArray(c.transcript) ? c.transcript : [];
		const drafts = Array.isArray(c.drafts) ? c.drafts : [];
		return {
			id: c.id,
			matchId: c.match_id,
			status: c.status,
			ownerName: nameById.get(c.owner_user_id) ?? '—',
			callerName: nameById.get(c.caller_user_id) ?? '—',
			usedClonedVoice: !!c.used_cloned_voice,
			durationS: c.duration_s ?? null,
			startedAt: c.started_at,
			endedAt: c.ended_at ?? null,
			failureReason: c.failure_reason ?? null,
			turnCount: transcript.length,
			draftCount: drafts.length,
			recap: summary?.content ?? null,
			signal: summary?.ai_signal ?? null,
			read: summary?.ai_read ?? null,
			transcript,
			drafts
		};
	});

	return { calls: rows };
};
