import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import type { Message } from '$lib/verified-vibe/types';

interface SendMessageRequest {
  conversationId: string;
  content: string;
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

    // Validate content length (max 5000 characters)
    if (body.content.length > 5000) {
      return json(
        { error: 'Message content exceeds maximum length of 5000 characters' },
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

    // Save message to database
    const { data: savedMessage, error: saveError } = await supabase
      .from('verified_vibe_messages')
      .insert({
        match_id: body.conversationId,
        sender_id: user.id,
        content: body.content.trim()
      })
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

    // Fire-and-forget insight extraction (non-blocking)
    extractAndUpdatePreferences(user.id, body.content.trim())
      .catch(err => console.error('[preferences] insight extraction failed (non-critical):', err));

    return json(response, { status: 201 });
  } catch (error) {
    console.error('Send message error:', error);
    return json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
};
