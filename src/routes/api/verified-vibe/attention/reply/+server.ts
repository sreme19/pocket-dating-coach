/**
 * POST /api/verified-vibe/attention/reply
 *
 * Recipient sends a one-time reply to an attention message.
 * Updates reply_content and reply_sent_at on the existing row.
 *
 * Body: { messageId, replyContent }
 * Response: { ok: true }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json() as {
      messageId?: string;
      replyContent?: string;
    };

    const messageId    = body.messageId?.trim();
    const replyContent = body.replyContent?.trim();

    if (!messageId)                        return json({ error: 'Missing messageId' }, { status: 400 });
    if (!replyContent)                     return json({ error: 'Reply content is required' }, { status: 400 });
    if (replyContent.length > 500)         return json({ error: 'Reply must be under 500 characters' }, { status: 400 });

    const supabase = getSupabase();

    // Only update if not already replied
    const { data: existing } = await (supabase as any)
      .from('attention_messages')
      .select('reply_content')
      .eq('id', messageId)
      .single();

    if (existing?.reply_content) {
      return json({ error: 'Already replied to this message' }, { status: 409 });
    }

    const { error } = await (supabase as any)
      .from('attention_messages')
      .update({ reply_content: replyContent, reply_sent_at: new Date().toISOString() })
      .eq('id', messageId);

    if (error) {
      console.error('[Attention reply] update error:', error);
      return json({ error: 'Failed to save reply' }, { status: 500 });
    }

    return json({ ok: true });
  } catch (err) {
    console.error('[Attention reply] error:', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
