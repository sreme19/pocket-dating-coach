import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { waitUntil } from '@vercel/functions';
import { getSupabase } from '$lib/server/supabase';
import { getTrustScoreBand } from '$lib/server/pool-registry';
import type { Message } from '$lib/verified-vibe/types';
import { logAppError } from '$lib/server/logAppError';
import { buildNotificationPayload, sendNotification } from '$lib/server/notifications';

// The server-side AI Bestie reply is generated in a waitUntil() background task
// after the response is flushed (see below). waitUntil keeps the function alive
// only until this maxDuration — NOT indefinitely. Bestie generation measures
// ~9s (Claude ~8s + DB reads/writes), which does not fit inside Vercel's short
// default (~10s) after the send's own synchronous work, so the reply was being
// truncated and never inserted. Give the function room to finish it.
export const config = { maxDuration: 60 };

interface SendMessageRequest {
  conversationId: string;
  content: string;
  isAi?: boolean;
}

interface SendMessageResponse {
  data: {
    message: Message;
  };
}

async function extractAndUpdatePreferences(
  senderId: string,
  messageContent: string
): Promise<void> {
  // 1. Look up sender's gender/archetype from verified_vibe_users
  const supabase = getSupabase();
  const { data: sender } = await supabase
    .from('verified_vibe_users')
    .select('gender, archetype, about, looking')
    .eq('id', senderId)
    .single();

  // Only process female users. Check gender field first (most reliable),
  // then fall back to archetype string (covers both enum values and descriptive labels).
  if (!sender) return;
  const isFemale =
    sender.gender === 'woman' ||
    sender.archetype === 'spoilt_woman' ||
    sender.archetype === 'safety_first_woman' ||
    String(sender.archetype ?? '').toLowerCase().includes('woman');
  if (!isFemale) return;

  // 2. Ask Claude to extract any preference signals from her message
  const { getClaudeClient, CLAUDE_MODEL } = await import('$lib/claude');
  const client = getClaudeClient();

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `A woman sent this message to a potential match: "${messageContent}"

Does this message reveal any new preferences, boundaries, dealbreakers, or what she values? Extract only what is explicitly stated — do not infer.

Return JSON only:
{
  "newDealbreakers": [],
  "newBoundaries": [],
  "newEmotionalSignals": [],
  "newPrivateNotes": []
}
Return empty arrays if nothing new is expressed. Never invent signals.`
    }]
  });

  const block = response.content[0];
  if (block.type !== 'text') return;

  // 3. Parse and merge into preferences (strip markdown fences — Claude 4.x wraps JSON)
  const raw = block.text.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
  const extracted = JSON.parse(raw);

  // Only update if there's actually something new
  const hasNew = extracted.newDealbreakers.length > 0 ||
    extracted.newBoundaries.length > 0 ||
    extracted.newEmotionalSignals.length > 0 ||
    extracted.newPrivateNotes.length > 0;

  if (!hasNew) return;

  const { loadPreferences, updatePreferences } = await import('$lib/server/profile-service');
  const current = await loadPreferences(senderId);

  await updatePreferences(senderId, {
    dealbreakers: [...new Set([...current.dealbreakers, ...extracted.newDealbreakers])],
    boundaries: [...new Set([...current.boundaries, ...extracted.newBoundaries])],
    emotionalSignals: [...new Set([...current.emotionalSignals, ...extracted.newEmotionalSignals])],
    privateCompatibilityNotes: [...new Set([...current.privateCompatibilityNotes, ...extracted.newPrivateNotes])]
  }, `Updated from message: "${messageContent.slice(0, 60)}..."`);
}

/**
 * POST /api/verified-vibe/chat/send
 *
 * Sends a message in a conversation.
 *
 * Request body:
 * {
 *   conversationId: string (match ID)
 *   content: string (message text)
 * }
 *
 * Response:
 * {
 *   data: {
 *     message: {
 *       id: string
 *       matchId: string
 *       senderId: string
 *       content: string
 *       createdAt: Date
 *     }
 *   }
 * }
 *
 * Error responses:
 * - 400: Invalid request (missing conversationId or content)
 * - 401: Unauthorized (not authenticated)
 * - 404: Conversation not found
 * - 500: Internal server error
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Create a client with the user's token to get their ID
    const { createClient } = await import('@supabase/supabase-js');
    const { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } = await import('$env/static/public');
    const userClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user?.id) {
      return json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json() as SendMessageRequest;

    // Validate required fields
    if (!body.conversationId || !body.content) {
      return json(
        { error: 'Missing required fields: conversationId, content' },
        { status: 400 }
      );
    }

    // Validate content is not empty
    if (body.content.trim().length === 0) {
      return json(
        { error: 'Message content cannot be empty' },
        { status: 400 }
      );
    }

    // Validate content length (max 2000 characters)
    if (body.content.length > 2000) {
      return json(
        { error: 'Message content exceeds maximum length of 2000 characters' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Verify user is part of the conversation
    const { data: match, error: matchError } = await supabase
      .from('verified_vibe_matches')
      .select('*')
      .eq('id', body.conversationId)
      .single();

    if (matchError || !match) {
      return json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    if (match.user1_id !== user.id && match.user2_id !== user.id) {
      return json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Reject sends to an ended (soft-deleted) match. The row survives for analytics
    // once unmatched/blocked, but it's no longer a live conversation.
    if ((match as any).status === 'unmatched' || (match as any).status === 'blocked') {
      return json(
        { error: 'match_ended', message: 'This conversation is no longer available.' },
        { status: 404 }
      );
    }

    // Save message to database
    const { data: savedMessage, error: saveError } = await supabase
      .from('verified_vibe_messages')
      .insert({
        match_id: body.conversationId,
        sender_id: user.id,
        content: body.content.trim(),
        created_at: new Date().toISOString(), // explicit timestamp to avoid NULL ordering issues
        // Only include is_ai if the column exists (migration may not have run yet)
        ...(body.isAi === true ? { is_ai: true } : {})
      } as any)
      .select()
      .single();

    if (saveError || !savedMessage) {
      console.error('Error saving message:', saveError);
      return json(
        { error: 'Failed to save message' },
        { status: 500 }
      );
    }

    // Transform to Message type
    const message: Message = {
      id: savedMessage.id,
      matchId: savedMessage.match_id,
      senderId: savedMessage.sender_id,
      content: savedMessage.content,
      createdAt: new Date(savedMessage.created_at)
    };

    const response: SendMessageResponse = {
      data: {
        message
      }
    };

    // ── Server-side AI Bestie auto-response ───────────────────────────────────
    // If this message was sent TO a woman who has AI Bestie active (and the
    // message isn't itself AI-generated), Bestie replies on her behalf — server
    // side, so it works even when her app is closed.
    //
    // This used to be AWAITED before the response returned, which made every
    // send block for the full Claude round-trip (several seconds). That long
    // window was the root of the duplicate-message race on the client. We now
    // schedule it via waitUntil(): the response returns immediately and Vercel
    // keeps the function alive to finish generation in the background. The
    // sender's client fast-polls for the reply, so it still appears promptly.
    // Bestie is default-ON: only an explicit `false` turns it off. Treating
    // null/undefined as OFF here (while the opener guard treats it as ON) would
    // make a match open a thread and then go permanently silent. Mirror the
    // opener's `!== false` semantics.
    if (body.isAi !== true && (match as any).ai_bestie_active !== false) {
      const recipientId = match.user1_id === user.id ? match.user2_id : match.user1_id;
      const bestieTask = (async () => {
        try {
          const { data: recipient } = await supabase
            .from('verified_vibe_users')
            .select('gender')
            .eq('id', recipientId)
            .single();
          if (recipient?.gender === 'woman') {
            // The man texted — Bestie replies on the woman's behalf.
            const { generateAndSendBestieReply } = await import('$lib/server/bestie-responder');
            await generateAndSendBestieReply(recipientId, body.conversationId, savedMessage.id, body.content.trim(), savedMessage.created_at);
          } else if (recipient?.gender === 'man') {
            // The woman (Bestie's owner) is texting back herself → she's taking
            // over. Deactivate Bestie so it stops auto-replying, then leave one
            // final hard-coded sign-off (stored as AI, in her own thread). The
            // ai_bestie_active=true guard makes this fire exactly once even if
            // she sends two messages before the first deactivation lands.
            const { data: deactivated } = await supabase
              .from('verified_vibe_matches')
              .update({ ai_bestie_active: false })
              .eq('id', body.conversationId)
              .eq('ai_bestie_active', true)
              .select('id');
            if (deactivated && deactivated.length > 0) {
              const { data: owner } = await supabase
                .from('verified_vibe_users')
                .select('first_name')
                .eq('id', user.id)
                .single();
              const ownerName = owner?.first_name?.trim() || 'She';
              await supabase
                .from('verified_vibe_messages')
                .insert({
                  match_id: body.conversationId,
                  sender_id: user.id,
                  content: `Okay I'm gonna let you two take it from here! ${ownerName}, he's all yours`,
                  is_ai: true
                } as any);
            }
          }
        } catch (bestieErr) {
          // Never let Bestie failure break the send.
          console.error('Server-side Bestie handling failed (non-fatal):', bestieErr);
        }
      })();
      // On Vercel this defers the work past the response without the runtime
      // freezing it; in local dev the long-lived process completes it anyway.
      // Deliberately NOT awaited — that's the whole point.
      waitUntil(bestieTask);
    }

    // Check for 'converted' milestone: fires exactly once when message count reaches 5
    // Direct DB write — more reliable than a fire-and-forget HTTP call on Vercel
    const { count: msgCount } = await supabase
      .from('verified_vibe_messages')
      .select('id', { count: 'exact', head: true })
      .eq('match_id', body.conversationId);

    if (msgCount === 5) {
      // Record 'converted' outcome signal — just DB writes so fast enough to await
      try {
        const matchedUserId = match.user1_id === user.id ? match.user2_id : match.user1_id;
        const db = getSupabase() as any;
        const { data: users } = await db
          .from('verified_vibe_users')
          .select('id, gender, archetype, trust_score')
          .in('id', [user.id, matchedUserId]);

        const maleUser   = users?.find((u: any) => u.gender === 'man');
        const femaleUser = users?.find((u: any) => u.gender === 'woman');

        if (maleUser && femaleUser) {
          await db.from('vv_match_outcome_signals').insert({
            match_id:            body.conversationId,
            male_user_id:        maleUser.id,
            female_user_id:      femaleUser.id,
            outcome:             'converted',
            initiated_by_gender: null,   // both parties engaged
            compatibility_score: null,
            male_archetype:      maleUser.archetype,
            female_archetype:    femaleUser.archetype,
            male_trust_band:     getTrustScoreBand(maleUser.trust_score ?? 0),
            outcome_at:          new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('[converted-signal] non-critical failure:', err);
      }
    }

    // Fire-and-forget insight extraction (non-blocking).
    // Women → her preferences; men → his own self-claims + stated preferences fold
    // into his vectors (Design §11e). Each helper self-guards on gender.
    extractAndUpdatePreferences(user.id, body.content.trim())
      .catch(err => console.error('[preferences] insight extraction failed (non-critical):', err));
    waitUntil(
      import('$lib/server/chat-intel-capture')
        .then(({ captureMaleChatIntel }) => captureMaleChatIntel(user.id, body.content.trim()))
        .catch(err => console.error('[chat-intel] male capture failed (non-critical):', err))
    );

    // Fire-and-forget push notification to the recipient
    const recipientId = match.user1_id === user.id ? match.user2_id : match.user1_id;
    waitUntil((async () => {
      try {
        const db = getSupabase();
        const [{ data: tokenRow }, { data: sender }] = await Promise.all([
          db.from('device_tokens').select('token').eq('user_id', recipientId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
          db.from('verified_vibe_users').select('first_name').eq('id', user.id).maybeSingle(),
        ]);
        if (!tokenRow?.token) return;
        const senderName = (sender as any)?.first_name ?? 'Someone';
        const preview = body.content.trim().slice(0, 100);
        const payload = buildNotificationPayload({
          token: tokenRow.token,
          title: senderName,
          body: preview,
          type: 'conversation_reminder',
          deepLink: `/verified-vibe/chat/${body.conversationId}`,
        });
        await sendNotification(payload);
      } catch (e) {
        console.error('[push] failed (non-critical):', e);
      }
    })());

    return json(response, { status: 201 });
  } catch (error) {
    console.error('Send message error:', error);
    logAppError(error, {
      feature: 'Chat',
      file: 'src/routes/api/verified-vibe/chat/send/+server.ts',
      endpoint: 'POST /api/verified-vibe/chat/send',
      userId: user?.id,
    }).catch(() => {});
    return json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
};
