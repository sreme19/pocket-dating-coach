/**
 * POST /api/verified-vibe/attention/reply-with-bestie
 *
 * Recipient (a woman) hands an attention message off to her AI Bestie instead of
 * replying herself. Delegates to the shared engageBestieForAttention helper, which
 * creates a mutual match with ai_bestie_active = true, seeds the conversation with
 * the sender's original note, marks the message handled, then triggers Bestie to
 * reply — the same path a man's Craving Attention now fires automatically on send.
 *
 * Body: { messageId }
 * Response: { ok: true, matchId }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { engageBestieForAttention } from '$lib/server/attention-bestie';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json() as { messageId?: string };
    const messageId = body.messageId?.trim();

    if (!messageId) return json({ error: 'Missing messageId' }, { status: 400 });

    const result = await engageBestieForAttention(messageId);
    if (result.status === 'not_found') {
      return json({ error: 'Message not found' }, { status: 404 });
    }

    return json({ ok: true, matchId: result.matchId });
  } catch (err) {
    console.error('[reply-with-bestie] error:', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
