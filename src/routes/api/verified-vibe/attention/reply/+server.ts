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

    // Fetch the full attention message so we can auto-create a match
    const { data: attnMsg } = await (supabase as any)
      .from('attention_messages')
      .select('id, sender_id, recipient_id, content, created_at')
      .eq('id', messageId)
      .single();

    const { error } = await (supabase as any)
      .from('attention_messages')
      .update({ reply_content: replyContent, reply_sent_at: new Date().toISOString() })
      .eq('id', messageId);

    if (error) {
      console.error('[Attention reply] update error:', error);
      return json({ error: 'Failed to save reply' }, { status: 500 });
    }

    // ── Auto-create a verified match so both users get a full chat thread ────
    let autoMatchId: string | null = null;
    if (attnMsg) {
      try {
        const admirer   = attnMsg.sender_id;    // Neha — sent the admirer msg
        const recipient = attnMsg.recipient_id; // Ryan  — just replied

        // Check for an existing match between these two users
        const { data: existingMatch } = await supabase
          .from('verified_vibe_matches')
          .select('id')
          .or(
            `and(user1_id.eq.${admirer},user2_id.eq.${recipient}),` +
            `and(user1_id.eq.${recipient},user2_id.eq.${admirer})`
          )
          .maybeSingle();

        if (existingMatch) {
          autoMatchId = existingMatch.id;
        } else {
          // Create a mutual match
          const { data: newMatch, error: matchErr } = await supabase
            .from('verified_vibe_matches')
            .insert({ user1_id: admirer, user2_id: recipient, status: 'mutual' })
            .select('id')
            .single();

          if (!matchErr && newMatch) {
            autoMatchId = newMatch.id;

            // Seed the conversation with the two messages from the admirer exchange
            await supabase.from('verified_vibe_messages').insert([
              {
                match_id:   newMatch.id,
                sender_id:  admirer,
                content:    attnMsg.content,
                created_at: attnMsg.created_at, // preserve original timestamp
              },
              {
                match_id:  newMatch.id,
                sender_id: recipient,
                content:   replyContent,
                // created_at defaults to now()
              },
            ]);
          }
        }
      } catch (matchCreateErr) {
        // Non-fatal — reply was saved; match creation is best-effort
        console.warn('[Attention reply] auto-match creation failed:', matchCreateErr);
      }
    }

    return json({ ok: true, matchId: autoMatchId });
  } catch (err) {
    console.error('[Attention reply] error:', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
