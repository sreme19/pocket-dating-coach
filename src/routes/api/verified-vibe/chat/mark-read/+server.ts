import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';

/**
 * POST /api/verified-vibe/chat/mark-read
 *
 * Stamps the current user's last-read timestamp for a match to NOW().
 * Called whenever a user opens a conversation so the unread count clears.
 *
 * Body: { matchId: string, userId: string }
 * Response: { ok: true } | { error: string }
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { matchId, userId } = (await request.json()) as {
			matchId?: string;
			userId?: string;
		};

		if (!matchId || !userId) {
			return json({ error: 'matchId and userId are required' }, { status: 400 });
		}

		const supabase = getSupabase();

		// Find the match and determine which column to update
		const { data: match, error: fetchError } = await supabase
			.from('verified_vibe_matches')
			.select('id, user1_id, user2_id')
			.eq('id', matchId)
			.single();

		if (fetchError || !match) {
			return json({ error: 'Match not found' }, { status: 404 });
		}

		const isUser1 = match.user1_id === userId;
		const isUser2 = match.user2_id === userId;

		if (!isUser1 && !isUser2) {
			return json({ error: 'User is not a participant in this match' }, { status: 403 });
		}

		const column = isUser1 ? 'user1_last_read_at' : 'user2_last_read_at';
		const now = new Date().toISOString();

		const { error: updateError } = await supabase
			.from('verified_vibe_matches')
			.update({ [column]: now })
			.eq('id', matchId);

		if (updateError) {
			console.error('[mark-read] update error:', updateError);
			return json({ error: 'Failed to mark as read' }, { status: 500 });
		}

		return json({ ok: true });
	} catch (err) {
		console.error('[mark-read]', err);
		return json(
			{ error: err instanceof Error ? err.message : 'Something went wrong' },
			{ status: 500 }
		);
	}
};
