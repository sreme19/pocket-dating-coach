/**
 * Shared orchestration for "a Craving Attention auto-engages the woman's AI Bestie."
 *
 * When a man sends a Craving Attention (man → woman), her Bestie takes over and
 * engages him immediately — the woman needn't act first, and Bestie engaging is
 * what creates the match (per the Notice Me spec). This helper forms (or reuses)
 * a mutual match with Bestie active, seeds the man's note as the opening message,
 * marks the attention message handled, and fires Bestie's reply in the background.
 *
 * Used by:
 *   - POST /attention                    — automatic trigger the instant a
 *                                          craving_attention is sent
 *   - POST /attention/reply-with-bestie  — the woman's manual "reply with Bestie"
 *                                          button on an admirer card
 *
 * Idempotent and non-fatal: if the attention message is already handled it returns
 * the existing match without re-firing, so it's safe to call fire-and-forget and
 * safe against a double-fire from both entry points.
 */
import { waitUntil } from '@vercel/functions';
import { getSupabase } from '$lib/server/supabase';

/** Written into attention_messages.reply_content to mark a note Bestie-handled. */
export const BESTIE_HANDLED_MARKER = '💚 Replied with AI Bestie';

export type EngageBestieResult =
  | { status: 'engaged'; matchId: string }
  | { status: 'already_handled'; matchId: string | null }
  | { status: 'not_found'; matchId: null };

export async function engageBestieForAttention(messageId: string): Promise<EngageBestieResult> {
  const supabase = getSupabase();

  // Fetch the attention message (and whether it's already been handled).
  const { data: attnMsg } = await (supabase as any)
    .from('attention_messages')
    .select('id, sender_id, recipient_id, content, created_at, reply_content')
    .eq('id', messageId)
    .single();

  if (!attnMsg) return { status: 'not_found', matchId: null };

  const admirer   = attnMsg.sender_id;    // the man who sent the note
  const recipient = attnMsg.recipient_id; // the woman whose Bestie engages

  // Look for an existing match between the two users (either direction).
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
    return { status: 'already_handled', matchId: existingMatch?.id ?? null };
  }

  let matchId = existingMatch?.id ?? null;
  let triggerMsgId: string | null = null;
  let triggerCreatedAt: string | null = null;

  if (!matchId) {
    // Create a mutual match with Bestie active — Bestie engaging IS the match.
    const { data: newMatch, error: matchErr } = await supabase
      .from('verified_vibe_matches')
      .insert({ user1_id: admirer, user2_id: recipient, status: 'mutual', source: 'notice_me', ai_bestie_active: true })
      .select('id')
      .single();

    if (matchErr || !newMatch) {
      throw new Error(`[engageBestieForAttention] failed to create match: ${matchErr?.message ?? 'unknown'}`);
    }
    matchId = newMatch.id;

    // Seed the conversation with the man's original note (preserve its timestamp)
    // so Bestie replies to what he actually said.
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

  // Mark the attention message handled so the admirer card won't offer a reply
  // again (also guards against a double-fire).
  await (supabase as any)
    .from('attention_messages')
    .update({ reply_content: BESTIE_HANDLED_MARKER, reply_sent_at: new Date().toISOString() })
    .eq('id', messageId);

  // Trigger Bestie's reply the same fire-and-forget way chat/send does: register
  // it with waitUntil so callers return immediately and Vercel keeps the function
  // alive to finish generation. The conversation screen polls, so the reply
  // appears within a few seconds.
  if (matchId && triggerMsgId) {
    const mId = matchId;
    const tId = triggerMsgId;
    const note = attnMsg.content;
    const createdAt = triggerCreatedAt ?? undefined;
    waitUntil((async () => {
      try {
        const { generateAndSendBestieReply } = await import('$lib/server/bestie-responder');
        await generateAndSendBestieReply(recipient, mId, tId, note, createdAt);
      } catch (err) {
        console.error('[engageBestieForAttention] Bestie reply failed (non-fatal):', err);
      }
    })());
  }

  return { status: 'engaged', matchId: matchId! };
}
