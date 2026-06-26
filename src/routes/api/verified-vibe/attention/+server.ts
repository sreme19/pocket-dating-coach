/**
 * POST /api/verified-vibe/attention
 *   Submit a Secret Admirer (female→male) or Craving Attention (male→female) message.
 *   One-time per (sender, recipient) pair — duplicate returns 409.
 *
 *   Body: { senderId, recipientId, messageType, content }
 *   Response: { ok: true, id }
 *
 * GET /api/verified-vibe/attention?recipientId=xxx
 *   Fetch all attention messages received by a user (for inbox tabs).
 *   Joins sender profile for name/avatar.
 *
 * GET /api/verified-vibe/attention?senderId=xxx
 *   Returns { sentToIds: string[] } — used by discover page to show "Sent ✓" state.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
import { engageBestieForAttention } from '$lib/server/attention-bestie';
import { buildNotificationPayload, sendNotification } from '$lib/server/notifications';
import type { NotificationType } from '$lib/server/notifications';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json() as {
      senderId?: string;
      recipientId?: string;
      messageType?: string;
      content?: string;
    };

    const senderId    = body.senderId?.trim();
    const recipientId = body.recipientId?.trim();
    const messageType = body.messageType?.trim();
    const content     = body.content?.trim();

    if (!senderId)    return json({ error: 'Missing senderId' },    { status: 400 });
    if (!recipientId) return json({ error: 'Missing recipientId' }, { status: 400 });
    if (!messageType || !['secret_admirer', 'craving_attention'].includes(messageType)) {
      return json({ error: 'Invalid messageType' }, { status: 400 });
    }
    if (!content)      return json({ error: 'Message content is required' }, { status: 400 });
    if (content.length > 500) return json({ error: 'Message must be under 500 characters' }, { status: 400 });

    const supabase = getSupabase();

    const { data, error } = await (supabase as any)
      .from('attention_messages')
      .insert({ sender_id: senderId, recipient_id: recipientId, message_type: messageType, content })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        return json({ error: 'You have already sent a message to this person' }, { status: 409 });
      }
      console.error('[Attention] insert error:', error);
      return json({ error: 'Failed to save message' }, { status: 500 });
    }

    // Man → woman (Craving Attention): her AI Bestie auto-engages the instant the
    // note is sent — Bestie engaging IS what forms the match, so he lands in an
    // active thread with a Bestie reply rather than a dead "waiting for reply" card.
    // We await the synchronous match creation so the match definitely exists by the
    // time we respond; Bestie's reply itself is generated in the background. A
    // Secret Admirer (woman → man) stays manual — the man always speaks first.
    if (messageType === 'craving_attention') {
      try {
        await engageBestieForAttention(data.id);
      } catch (e) {
        // Non-fatal: the note is already saved; she can still hand off manually.
        console.error('[Attention] Bestie auto-engage failed (non-fatal):', e);
      }
    }

    // Fire-and-forget push notification to recipient
    (async () => {
      try {
        const supabase = getSupabase();
        const [{ data: sender }, { data: tokenRow }] = await Promise.all([
          supabase.from('verified_vibe_users').select('first_name').eq('id', senderId!).single(),
          supabase.from('device_tokens').select('token').eq('user_id', recipientId!).maybeSingle(),
        ]);
        if (tokenRow?.token) {
          const name = (sender as any)?.first_name ?? 'Someone';
          const isAdmirer = messageType === 'secret_admirer';
          const payload = buildNotificationPayload({
            token: tokenRow.token,
            title: isAdmirer ? '💝 Secret Admirer' : '✨ Someone Noticed You',
            body: isAdmirer
              ? `${name} has a secret crush on you`
              : `${name} is craving your attention`,
            type: messageType as NotificationType,
            deepLink: '/messages',
          });
          await sendNotification(payload);
        }
      } catch {
        // best-effort — don't block the response
      }
    })();

    return json({ ok: true, id: data.id });
  } catch (err) {
    console.error('[Attention] POST error:', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};

export const GET: RequestHandler = async ({ url }) => {
  try {
    const recipientId = url.searchParams.get('recipientId')?.trim();
    const senderId    = url.searchParams.get('senderId')?.trim();

    if (!recipientId && !senderId) {
      return json({ error: 'Provide recipientId or senderId' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Sent-IDs mode — discover page "Sent ✓" check
    if (senderId && !recipientId) {
      const withDetails = url.searchParams.get('withDetails') === 'true';

      if (!withDetails) {
        // Lightweight: just return IDs for Discover "Sent ✓" markers
        const { data } = await (supabase as any)
          .from('attention_messages')
          .select('recipient_id')
          .eq('sender_id', senderId);

        return json({ sentToIds: (data ?? []).map((r: any) => r.recipient_id) });
      }

      // Full details mode — Messages tab shows the sender's outbound admirer cards
      const { data: sentMsgs, error: sentErr } = await (supabase as any)
        .from('attention_messages')
        .select('id, recipient_id, message_type, content, reply_content, reply_sent_at, created_at')
        .eq('sender_id', senderId)
        .order('created_at', { ascending: false });

      if (sentErr) return json({ error: 'Failed to fetch sent messages' }, { status: 500 });
      if (!sentMsgs?.length) return json({ messages: [] });

      const recipientIds = [...new Set((sentMsgs as any[]).map((m: any) => m.recipient_id))] as string[];
      const { data: recipientProfiles } = await supabase
        .from('verified_vibe_users')
        .select('id, first_name, age, avatar_url, archetype')
        .in('id', recipientIds);

      const recipMap = new Map((recipientProfiles ?? []).map((r: any) => [r.id, r]));

      const messages = (sentMsgs as any[]).map((m: any) => {
        const r = recipMap.get(m.recipient_id) as any;
        return {
          id:                  m.id,
          recipientId:         m.recipient_id,
          recipientName:       r?.first_name  ?? 'Unknown',
          recipientAge:        r?.age         ?? null,
          recipientAvatar:     r?.avatar_url  ?? null,
          recipientArchetype:  r?.archetype   ?? null,
          messageType:         m.message_type,
          content:             m.content,
          replyContent:        m.reply_content  ?? null,
          replySentAt:         m.reply_sent_at  ?? null,
          createdAt:           m.created_at,
        };
      });

      return json({ messages });
    }

    // Inbox mode — fetch messages with sender profile details
    const { data: msgs, error } = await (supabase as any)
      .from('attention_messages')
      .select('id, sender_id, message_type, content, reply_content, reply_sent_at, is_read, created_at')
      .eq('recipient_id', recipientId)
      .order('created_at', { ascending: false });

    if (error) return json({ error: 'Failed to fetch messages' }, { status: 500 });
    if (!msgs?.length) return json({ messages: [] });

    // Enrich with sender profile
    const senderIds = [...new Set((msgs as any[]).map((m: any) => m.sender_id))];
    const { data: senders } = await supabase
      .from('verified_vibe_users')
      .select('id, first_name, age, avatar_url, archetype')
      .in('id', senderIds as string[]);

    const senderMap = new Map((senders ?? []).map((s: any) => [s.id, s]));

    const messages = (msgs as any[]).map((m: any) => {
      const sender = senderMap.get(m.sender_id) as any;
      return {
        id:           m.id,
        senderId:     m.sender_id,
        senderName:   sender?.first_name   ?? 'Unknown',
        senderAge:    sender?.age          ?? null,
        senderAvatar: sender?.avatar_url   ?? null,
        senderArchetype: sender?.archetype ?? null,
        messageType:  m.message_type,
        content:      m.content,
        replyContent: m.reply_content ?? null,
        replySentAt:  m.reply_sent_at ?? null,
        isRead:       m.is_read,
        createdAt:    m.created_at,
      };
    });

    // Mark all as read (fire-and-forget)
    (supabase as any)
      .from('attention_messages')
      .update({ is_read: true })
      .eq('recipient_id', recipientId)
      .eq('is_read', false)
      .then(() => { /* no-op */ });

    return json({ messages });
  } catch (err) {
    console.error('[Attention] GET error:', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
