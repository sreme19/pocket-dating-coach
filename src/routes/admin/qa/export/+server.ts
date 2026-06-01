import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
import { listReviewQueue } from '$lib/server/qa-service';

function csvCell(v: unknown): string {
	const s = v === null || v === undefined ? '' : String(v);
	return `"${s.replace(/"/g, '""')}"`;
}

/** Flatten the review queue to CSV — for offline review or archival. */
export const GET: RequestHandler = async () => {
	const queue = await listReviewQueue(getSupabase());

	const header = [
		'kind',
		'id',
		'participant_a',
		'participant_b',
		'match_status',
		'last_activity',
		'messages',
		'ai_sent',
		'coached',
		'coaching_threads',
		'review_status',
		'review_avg_score',
		'reviewer'
	];

	const lines = [header.map(csvCell).join(',')];
	for (const r of queue) {
		lines.push(
			[
				r.kind,
				r.matchId,
				r.participantA.name,
				r.participantB.name,
				r.status,
				r.lastActivityAt ?? '',
				r.counts.messages,
				r.counts.aiMessages,
				r.counts.coached,
				r.counts.coachingThreads,
				r.review?.status ?? '',
				r.review?.avgScore ?? '',
				r.review?.reviewer ?? ''
			]
				.map(csvCell)
				.join(',')
		);
	}

	return new Response(lines.join('\n'), {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': 'attachment; filename="qa-queue.csv"'
		}
	});
};
