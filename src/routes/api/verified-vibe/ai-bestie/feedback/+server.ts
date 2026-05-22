import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';

/**
 * POST /api/verified-vibe/ai-bestie/feedback
 *
 * Records a thumbs-up or thumbs-down on an AI Bestie chat message.
 *
 * Body:
 * {
 *   userId:         string   // VV user ID
 *   feedbackType:   'positive' | 'negative'
 *   messageContent: string   // the AI message being rated (truncated server-side)
 * }
 *
 * Response: { ok: true } | { error: string }
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as {
			userId?: string;
			feedbackType?: string;
			messageContent?: string;
		};

		const userId        = (body.userId ?? '').trim();
		const feedbackType  = (body.feedbackType ?? '').trim();
		const messageContent = (body.messageContent ?? '').trim().slice(0, 2000); // cap at 2 k chars

		if (!userId) {
			return json({ error: 'userId is required' }, { status: 400 });
		}
		if (!['positive', 'negative'].includes(feedbackType)) {
			return json({ error: 'feedbackType must be "positive" or "negative"' }, { status: 400 });
		}
		if (!messageContent) {
			return json({ error: 'messageContent is required' }, { status: 400 });
		}

		const supabase = getSupabase();

		const { error: insertError } = await supabase
			.from('ai_bestie_feedback')
			.insert({ user_id: userId, feedback_type: feedbackType, message_content: messageContent });

		if (insertError) {
			console.error('[AI Bestie feedback] insert error:', insertError);
			return json({ error: 'Failed to save feedback' }, { status: 500 });
		}

		return json({ ok: true });
	} catch (err) {
		console.error('[AI Bestie feedback]', err);
		return json(
			{ error: err instanceof Error ? err.message : 'Something went wrong' },
			{ status: 500 }
		);
	}
};
