/**
 * POST /api/verified-vibe/attention/reply-with-bestie
 *
 * Recipient (a woman) hands an attention message off to her AI Bestie instead
 * of replying herself. Creates a mutual match with ai_bestie_active = true,
 * seeds the conversation with the sender's original note, then triggers Bestie
 * to reply to that note — the same fire-and-forget path chat/send uses once a
 * match has Bestie active. The attention message is marked handled so the card
 * won't offer a reply again (also guards against a double-fire).
 *
 * Body: { messageId }
 * Response: { ok: true, matchId }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { waitUntil } from '@vercel/functions';
import { getSupabase } from '$lib/server/supabase';

const BESTIE_HANDLED_MARKER = '💚 Replied with AI Bestie';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json() as { messageId?: string };
    const messageId = body.messageId?.trim();

    if (!messageId) return json({ error: 'Missing messageId' }, { status: 400 });

    const supabase = getSupabase();

    // Fetch the attention message (and whether it's already been handled)
    const { data: attnMsg } = await (supabase as any)
      .from('attention_messages')
      .select('id, sender_id, recipient_id, content, created_at, reply_content')
      .eq('id', messageId)
      .single();

    if (!attnMsg) return json({ error: 'Message not found' }, { status: 404 });

    const admirer   = attnMsg.sender_id;    // the man who sent the note
    const recipient = attnMsg.recipient_id; // the woman handing off to Bestie

    // Look for an existing match between the two users.
    const { data: existingMatch } = await supabase
      .from('verified_vibe_matches')
      .select('id')
      .or(
        `and(user1_id.eq.${admirer},user2_id.eq.${recipient}),` +
        `and(user1_id.eq.${recipient},user2_id.eq.${admirer})`
      )
      .maybeSingle();

    // Idempotent: if already handled, just return the existing conversation.
    if (attnMsg.reply_content) {
      return json({ ok: true, matchId: existingMatch?.id ?? null });
    }

    let matchId = existingMatch?.id ?? null;
    let triggerMsgId: string | null = null;
    let triggerCreatedAt: string | null = null;

    if (!matchId) {
      // Create a mutual match with Bestie active.
      const { data: newMatch, error: matchErr } = await supabase
        .from('verified_vibe_matches')
        .insert({ user1_id: admirer, user2_id: recipient, status: 'mutual', ai_bestie_active: true })
        .select('id')
        .single();

      if (matchErr || !newMatch) {
        console.error('[reply-with-bestie] match create error:', matchErr);
        return json({ error: 'Failed to create match' }, { status: 500 });
      }
      matchId = newMatch.id;

      // Seed the conversation with the man's original note (preserve timestamp).
      const { data: seeded } = await supabase
        .from('verified_vibe_messages')
        .insert({
          match_id:   matchId,
          sender_id:  admirer,
          content:    attnMsg.content,
          created_at: attnMsg.created_at,
        })
        .select('id, created_at')
        .single();
      triggerMsgId     = seeded?.id ?? null;
      triggerCreatedAt = seeded?.created_at ?? null;
    } else {
      // Match already exists — make sure Bestie is active on it.
      await supabase
        .from('verified_vibe_matches')
        .update({ ai_bestie_active: true })
        .eq('id', matchId);
    }

    // Mark the attention message handled so the card won't offer a reply again.
    await (supabase as any)
      .from('attention_messages')
      .update({ reply_content: BESTIE_HANDLED_MARKER, reply_sent_at: new Date().toISOString() })
      .eq('id', messageId);

    // Trigger Bestie's reply the same fire-and-forget way chat/send does: return
    // immediately and let Vercel keep the function alive to finish generation.
    // The conversation screen polls, so the reply appears within a few seconds.
    if (matchId && triggerMsgId) {
      const mId = matchId;
      const tId = triggerMsgId;
      const task = (async () => {
        try {
          const { generateAndSendBestieReply } = await import('$lib/server/bestie-responder');
          await generateAndSendBestieReply(recipient, mId, tId, attnMsg.content, triggerCreatedAt ?? undefined);
        } catch (err) {
          console.error('[reply-with-bestie] Bestie reply failed (non-fatal):', err);
        }
      })();
      waitUntil(task);
    }

    return json({ ok: true, matchId });
  } catch (err) {
    console.error('[reply-with-bestie] error:', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
