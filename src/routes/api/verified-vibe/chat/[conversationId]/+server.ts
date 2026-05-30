import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import type { Archetype, Message, VerifiedVibeUser } from '$lib/verified-vibe/types';

interface ConversationResponse {
  data: {
    matchedUser: VerifiedVibeUser;
    messages: Message[];
    aiBestieActive: boolean;
  };
}

/**
 * GET /api/verified-vibe/chat/[conversationId]
 *
 * Retrieves a specific conversation with message history.
 *
 * Response:
 * {
 *   data: {
 *     matchedUser: {
 *       id: string
 *       firstName: string
 *       age: number
 *       city: string
 *       avatar: string | null
 *       ...
 *     }
 *     messages: Message[]
 *   }
 * }
 *
 * Error responses:
 * - 401: Unauthorized (not authenticated)
 * - 404: Conversation not found
 * - 500: Internal server error
 */
export const GET: RequestHandler = async ({ params, request }) => {
  try {
    const conversationId = params.conversationId;

    if (!conversationId) {
      return json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }

    // Get auth token from header
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      console.error('No auth token provided');
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
      console.error('Auth error:', userError);
      return json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = getSupabase();

    // Get the match
    const { data: match, error: matchError } = await supabase
      .from('verified_vibe_matches')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (matchError || !match) {
      console.error('Match error:', matchError);
      return json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Verify user is part of this match
    if (match.user1_id !== user.id && match.user2_id !== user.id) {
      console.error('User not part of match');
      return json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Determine the other user ID
    const otherUserId = match.user1_id === user.id ? match.user2_id : match.user1_id;

    // Get the other user's profile
    const { data: matchedUser, error: userProfileError } = await supabase
      .from('verified_vibe_users')
      .select('*')
      .eq('id', otherUserId)
      .single();

    if (userProfileError || !matchedUser) {
      console.error('User profile error:', userProfileError);
      return json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get messages for this conversation
    const { data: dbMessages, error: messagesError } = await supabase
      .from('verified_vibe_messages')
      .select('*')
      .eq('match_id', conversationId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    // Transform messages to match the Message type
    const messages: Message[] = (dbMessages || []).map(msg => ({
      id: msg.id,
      matchId: msg.match_id,
      senderId: msg.sender_id,
      content: msg.content,
      isAi: (msg as any).is_ai ?? false,
      aiSignal: (msg as any).ai_signal ?? undefined,
      aiRead: (msg as any).ai_read ?? undefined,
      createdAt: new Date(msg.created_at)
    }));

    const response: ConversationResponse = {
      data: {
        matchedUser: {
          id: matchedUser.id,
          gender: matchedUser.gender,
          archetype: matchedUser.archetype as Archetype,
          firstName: matchedUser.first_name,
          age: matchedUser.age,
          city: matchedUser.city,
          avatar: matchedUser.avatar_url,
          about: matchedUser.about,
          looking: matchedUser.looking,
          trustScore: matchedUser.trust_score,
          createdAt: new Date(matchedUser.created_at),
          updatedAt: new Date(matchedUser.updated_at)
        },
        messages,
        aiBestieActive: match.ai_bestie_active ?? true
      }
    };

    return json(response);
  } catch (error) {
    console.error('Conversation fetch error:', error);
    return json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
};
