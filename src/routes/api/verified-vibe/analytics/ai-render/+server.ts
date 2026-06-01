import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';

/**
 * POST /api/verified-vibe/analytics/ai-render
 *
 * Records client-side delivery + render timing for an AI message, so the AI
 * Latency dashboard can show the full picture beyond server generation:
 *  - generatedAt: the AI reply's DB timestamp (when it became available)
 *  - receivedAt:  when the client's poll first surfaced it
 *  - renderedAt:  when it actually painted on screen
 *
 * Derived: surfaceMs (delivery lag = poll gap), renderMs (paint cost),
 * totalToRenderMs (generated → on-screen). Joined to the server-side
 * `ai_response_timing` event by replyMessageId.
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as {
			userId: string;
			matchId?: string;
			replyMessageId: string;
			responseType?: string;
			generatedAt?: string;
			receivedAt?: string;
			renderedAt?: string;
		};

		if (!body.userId || !body.replyMessageId) {
			return json({ error: 'Missing userId or replyMessageId' }, { status: 400 });
		}

		const gen = body.generatedAt ? new Date(body.generatedAt).getTime() : null;
		const recv = body.receivedAt ? new Date(body.receivedAt).getTime() : null;
		const rend = body.renderedAt ? new Date(body.renderedAt).getTime() : null;

		const surfaceMs = gen != null && recv != null ? Math.max(0, recv - gen) : null;
		const renderMs = recv != null && rend != null ? Math.max(0, rend - recv) : null;
		const totalToRenderMs = gen != null && rend != null ? Math.max(0, rend - gen) : null;

		const supabase = getSupabase();
		const { error } = await supabase.from('verified_vibe_analytics').insert({
			user_id: body.userId,
			event_type: 'ai_response_rendered',
			profile_id: null,
			metadata: {
				responseType: body.responseType ?? 'bestie',
				matchId: body.matchId ?? null,
				replyMessageId: body.replyMessageId,
				generatedAt: body.generatedAt ?? null,
				receivedAt: body.receivedAt ?? null,
				renderedAt: body.renderedAt ?? null,
				surfaceMs,
				renderMs,
				totalToRenderMs
			},
			created_at: new Date().toISOString()
		});

		if (error) {
			console.error('[ai-render] insert failed:', error);
			return json({ error: 'Failed to record render timing' }, { status: 500 });
		}

		return json({ success: true }, { status: 201 });
	} catch (e) {
		console.error('[ai-render] error:', e);
		return json({ error: 'Failed to process render timing' }, { status: 500 });
	}
};
