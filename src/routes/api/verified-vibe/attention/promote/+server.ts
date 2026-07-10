/**
 * POST /api/verified-vibe/attention/promote
 *
 * Promotes an attention message that already has a reply into a full
 * verified_vibe_matches conversation. Safe to call multiple times —
 * returns the existing match if one was already created.
 *
 * Body: { messageId: string }
 * Response: { ok: true, matchId: string }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json() as { messageId?: string };
    const messageId = body.messageId?.trim();
    if (!messageId) return json({ error: 'messageId is required' }, { status: 400 });

    const supabase = getSupabase();

    // Load the attention message
    const { data: attnMsg, error: fetchErr } = await (supabase as any)
      .from('attention_messages')
      .select('id, sender_id, recipient_id, content, reply_content, created_at')
      .eq('id', messageId)
      .single();

    if (fetchErr || !attnMsg) {
      return json({ error: 'Attention message not found' }, { status: 404 });
    }

    if (!attnMsg.reply_content) {
      return json({ error: 'Cannot promote — no reply yet' }, { status: 409 });
    }

    const admirer   = attnMsg.sender_id;    // e.g. Neha
    const recipient = attnMsg.recipient_id; // e.g. Ryan

    // Check for an existing match between the two users (any status — soft-deleted
    // rows survive for analytics, so there may be a terminal one).
    const { data: existingMatch } = await supabase
      .from('verified_vibe_matches')
      .select('id, status')
      .or(
        `and(user1_id.eq.${admirer},user2_id.eq.${recipient}),` +
        `and(user1_id.eq.${recipient},user2_id.eq.${admirer})`
      )
      .maybeSingle();

    if (existingMatch && (existingMatch as any).status === 'blocked') {
      // Blocked pair — never auto-reconnect (block clears only on unblock).
      return json({ error: 'Cannot promote — users are blocked' }, { status: 409 });
    }
    if (existingMatch) {
      // Reconnecting after an unmatch: revive the SAME row (one row per pair) with
      // fresh Bestie state rather than creating a duplicate. Already-mutual is reused.
      if ((existingMatch as any).status === 'unmatched') {
        await supabase
          .from('verified_vibe_matches')
          .update({ status: 'mutual', ai_bestie_active: true, bestie_checklist: null } as any)
          .eq('id', existingMatch.id);
      }
      return json({ ok: true, matchId: existingMatch.id });
    }

    // Create a mutual match
    const { data: newMatch, error: matchErr } = await supabase
      .from('verified_vibe_matches')
      .insert({ user1_id: admirer, user2_id: recipient, status: 'mutual' })
      .select('id')
      .single();

    if (matchErr || !newMatch) {
      console.error('[promote] match creation error:', matchErr);
      return json({ error: 'Failed to create match' }, { status: 500 });
    }

    // Seed the conversation with the admirer exchange
    await supabase.from('verified_vibe_messages').insert([
      {
        match_id:   newMatch.id,
        sender_id:  admirer,
        content:    attnMsg.content,
        created_at: attnMsg.created_at,
      },
      {
        match_id:  newMatch.id,
        sender_id: recipient,
        content:   attnMsg.reply_content,
      },
    ]);

    return json({ ok: true, matchId: newMatch.id });
  } catch (err) {
    console.error('[promote] error:', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
