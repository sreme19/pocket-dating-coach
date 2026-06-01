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

		// Delivery is the poll gap for a recipient who's watching — bounded by the
		// poll interval plus slack. A larger gap means history was backfilled on
		// (re)open, so the message's age leaks in as "delivery". Reject those: a
		// surface gap beyond this ceiling is staleness, not delivery latency.
		const MAX_DELIVERY_MS = 60000; // 60s
		const rawSurface = gen != null && recv != null ? Math.max(0, recv - gen) : null;
		const surfaceMs = rawSurface != null && rawSurface > MAX_DELIVERY_MS ? null : rawSurface;
		const renderMs = recv != null && rend != null ? Math.max(0, rend - recv) : null;
		const rawTotal = gen != null && rend != null ? Math.max(0, rend - gen) : null;
		const totalToRenderMs = rawTotal != null && rawTotal > MAX_DELIVERY_MS ? null : rawTotal;

		const supabase = getSupabase();
		// Merge the client stages into the row the server created at generation
		// time (keyed by reply_message_id). Upsert in case the server-side row is
		// missing (e.g. an AI message that predates server timing).
		const { error } = await (supabase as any)
			.from('vv_ai_response_timings')
			.upsert({
				reply_message_id: body.replyMessageId,
				match_id: body.matchId ?? null,
				response_type: body.responseType ?? 'bestie',
				received_at: body.receivedAt ?? null,
				rendered_at: body.renderedAt ?? null,
				surface_ms: surfaceMs,
				render_ms: renderMs,
				total_to_render_ms: totalToRenderMs
			}, { onConflict: 'reply_message_id' });

		if (error) {
			console.error('[ai-render] upsert failed:', error);
			return json({ error: 'Failed to record render timing' }, { status: 500 });
		}

		return json({ success: true }, { status: 201 });
	} catch (e) {
		console.error('[ai-render] error:', e);
		return json({ error: 'Failed to process render timing' }, { status: 500 });
	}
};
