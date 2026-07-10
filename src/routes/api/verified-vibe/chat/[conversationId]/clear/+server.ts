import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';

/**
 * DELETE /api/verified-vibe/chat/[conversationId]/clear
 *
 * Clears all messages from a conversation (seed users only for testing)
 * Requires a valid Bearer token and the user must be part of the match
 *
 * Query parameters:
 * - conversationId: the match ID to clear messages from
 *
 * Response:
 * {
 *   data: {
 *     deletedCount: number
 *   }
 * }
 */
export const DELETE: RequestHandler = async ({ params, request }) => {
  try {
    const { conversationId } = params;

    if (!conversationId) {
      return json(
        { error: 'Missing conversationId' },
        { status: 400 }
      );
    }

    // Get current user from Authorization header
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Create a client with the user's token to get their ID and email
    const { createClient } = await import('@supabase/supabase-js');
    const { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } = await import('$env/static/public');
    const userClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user: authUser } } = await userClient.auth.getUser();

    if (!authUser?.email) {
      return json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const currentUserId = authUser.id;

    // Use server-side client to delete messages
    const supabase = getSupabase();

    // Verify that the current user is part of this match
    const { data: match, error: matchError } = await (supabase as any)
      .from('verified_vibe_matches')
      .select('user1_id, user2_id, status')
      .eq('id', conversationId)
      .maybeSingle();

    if (matchError) {
      console.error('Error fetching match:', matchError);
      return json(
        { error: 'Failed to verify match' },
        { status: 500 }
      );
    }

    if (!match) {
      return json(
        { error: 'Match not found' },
        { status: 404 }
      );
    }

    // Verify user is part of this match
    const isPartOfMatch = match.user1_id === currentUserId || match.user2_id === currentUserId;
    if (!isPartOfMatch) {
      return json(
        { error: 'You are not part of this conversation' },
        { status: 403 }
      );
    }

    // Never clear an ended (unmatched/blocked) match — its messages are retained
    // for analytics and it's no longer a live conversation.
    if (match.status === 'unmatched' || match.status === 'blocked') {
      return json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Delete all messages for this conversation
    const { data, error: deleteError } = await (supabase as any)
      .from('verified_vibe_messages')
      .delete()
      .eq('match_id', conversationId)
      .select();

    if (deleteError) {
      console.error('Error deleting messages:', deleteError);
      return json(
        { error: 'Failed to clear chat messages' },
        { status: 500 }
      );
    }

    const deletedCount = data ? data.length : 0;

    return json({
      data: {
        deletedCount
      }
    });
  } catch (error) {
    console.error('Clear chat error:', error);
    return json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
};
