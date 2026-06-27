import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';

/**
 * POST /api/verified-vibe/ai-bestie/feedback
 *
 * Records a thumbs-up or thumbs-down on an AI advisor chat reply. Serves BOTH
 * the AI Bestie and AI Wingman chats — assistantType distinguishes them. On a
 * thumbs-down the client may also send a reason chip and an optional free-text
 * note (mirrors the proactive-greeting feedback flow).
 *
 * Body:
 * {
 *   userId:         string                 // VV user ID
 *   assistantType?: 'bestie' | 'wingman'   // defaults to 'bestie'
 *   feedbackType:   'positive' | 'negative'
 *   messageContent: string                 // the AI message being rated (truncated server-side)
 *   reasonChip?:    string | null          // only on negative; e.g. 'too_generic'
 *   feedbackText?:  string | null          // only on negative; optional free text
 * }
 *
 * Response: { ok: true } | { error: string }
 */

const VALID_REASON_CHIPS = ['too_generic', 'not_relevant', 'wrong_tone', 'factually_off', 'other'];

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as {
			userId?: string;
			assistantType?: string;
			feedbackType?: string;
			messageContent?: string;
			reasonChip?: string | null;
			feedbackText?: string | null;
		};

		const userId         = (body.userId ?? '').trim();
		const assistantType  = (body.assistantType ?? 'bestie').trim();
		const feedbackType   = (body.feedbackType ?? '').trim();
		const messageContent = (body.messageContent ?? '').trim().slice(0, 2000); // cap at 2 k chars

		if (!userId) {
			return json({ error: 'userId is required' }, { status: 400 });
		}
		if (!['bestie', 'wingman'].includes(assistantType)) {
			return json({ error: 'assistantType must be "bestie" or "wingman"' }, { status: 400 });
		}
		if (!['positive', 'negative'].includes(feedbackType)) {
			return json({ error: 'feedbackType must be "positive" or "negative"' }, { status: 400 });
		}
		if (!messageContent) {
			return json({ error: 'messageContent is required' }, { status: 400 });
		}

		// Reason chip + note only apply to negative feedback; ignore otherwise.
		let reasonChip: string | null = null;
		let feedbackText: string | null = null;
		if (feedbackType === 'negative') {
			const chip = (body.reasonChip ?? '').trim();
			reasonChip = VALID_REASON_CHIPS.includes(chip) ? chip : null;
			feedbackText = (body.feedbackText ?? '').trim().slice(0, 500) || null;
		}

		// Cast: generated DB types predate the assistant_type/reason_chip/feedback_text
		// columns (added in 20260602_ai_message_feedback_detail.sql). Same pattern as ai-greeting.
		const supabase = getSupabase() as any;

		const { error: insertError } = await supabase
			.from('ai_bestie_feedback')
			.insert({
				user_id: userId,
				assistant_type: assistantType,
				feedback_type: feedbackType,
				message_content: messageContent,
				reason_chip: reasonChip,
				feedback_text: feedbackText
			});

		if (insertError) {
			console.error('[AI advisor feedback] insert error:', insertError);
			return json({ error: 'Failed to save feedback' }, { status: 500 });
		}

		return json({ ok: true });
	} catch (err) {
		console.error('[AI advisor feedback]', err);
		return json(
			{ error: err instanceof Error ? err.message : 'Something went wrong' },
			{ status: 500 }
		);
	}
};
