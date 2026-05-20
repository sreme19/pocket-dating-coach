import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import type { VerifiedVibeUser } from '$lib/verified-vibe/types';

export interface Conversation {
  id: string;
  matchId: string;
  matchedUser: VerifiedVibeUser;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
}

interface ConversationsResponse {
  data: {
    conversations: Conversation[];
  };
}

/**
 * GET /api/verified-vibe/chat/conversations
 *
 * Retrieves all active conversations for the current user.
 * Conversations are sorted by most recent message first.
 * Each conversation includes:
 * - Match ID
 * - Matched user's name, photo, and basic info
 * - Last message preview
 * - Last message timestamp
 * - Unread message count
 *
 * Response:
 * {
 *   data: {
 *     conversations: Conversation[]
 *   }
 * }
 *
 * Conversation structure:
 * {
 *   id: string (conversation ID)
 *   matchId: string (match ID)
 *   matchedUser: {
 *     id: string
 *     firstName: string
 *     age: number
 *     avatar: string | null
 *     ...
 *   }
 *   lastMessage: string (message preview)
 *   lastMessageTime: Date
 *   unreadCount: number
 * }
 */
export const GET: RequestHandler = async ({ request }) => {
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

    const userId = user.id;
    const supabase = getSupabase();

    // Get all matches for the current user
    const { data: matches, error: matchesError } = await supabase
      .from('verified_vibe_matches')
      .select('id, user1_id, user2_id, status')
      .eq('status', 'mutual')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

    if (matchesError) {
      console.error('Error fetching matches:', matchesError);
      return json(
        { error: 'Failed to fetch matches' },
        { status: 500 }
      );
    }

    if (!matches || matches.length === 0) {
      return json({
        data: {
          conversations: []
        }
      });
    }

    // Build conversations
    const conversations: Conversation[] = [];

    for (const match of matches) {
      // Determine the other user ID
      const otherUserId = match.user1_id === userId ? match.user2_id : match.user1_id;

      // Get the other user's profile
      const { data: otherUser, error: userError } = await supabase
        .from('verified_vibe_users')
        .select('*')
        .eq('id', otherUserId)
        .single();

      if (userError || !otherUser) {
        console.error('Error fetching user:', userError);
        continue;
      }

      // Get the last message for this match
      const { data: messages, error: messagesError } = await supabase
        .from('verified_vibe_messages')
        .select('content, created_at')
        .eq('match_id', match.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        continue;
      }

      const lastMessage = messages?.[0];
      const lastMessageTime = lastMessage?.created_at ? new Date(lastMessage.created_at) : new Date();
      const lastMessageContent = lastMessage?.content || 'No messages yet';

      conversations.push({
        id: match.id,
        matchId: match.id,
        matchedUser: {
          id: otherUser.id,
          gender: otherUser.gender,
          archetype: otherUser.archetype,
          firstName: otherUser.first_name,
          age: otherUser.age,
          city: otherUser.city,
          avatar: otherUser.avatar_url,
          about: otherUser.about,
          looking: otherUser.looking,
          trustScore: otherUser.trust_score,
          createdAt: new Date(otherUser.created_at),
          updatedAt: new Date(otherUser.updated_at)
        },
        lastMessage: lastMessageContent,
        lastMessageTime,
        unreadCount: 0 // TODO: Implement unread count tracking
      });
    }

    // Sort by most recent message first
    const sorted = conversations.sort(
      (a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime()
    );

    const response: ConversationsResponse = {
      data: {
        conversations: sorted
      }
    };

    return json(response);
  } catch (error) {
    console.error('Conversations fetch error:', error);
    return json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
};
