import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
import type { Message } from '$lib/verified-vibe/types';

/**
 * GET /api/verified-vibe/message
 *
 * Fetches messages for a specific match.
 *
 * Query parameters:
 * - matchId: string (required) - The match ID
 * - limit: number (optional, default: 50) - Number of messages to fetch
 * - offset: number (optional, default: 0) - Pagination offset
 *
 * Response:
 * {
 *   data: {
 *     messages: Message[],
 *     total: number,
 *     hasMore: boolean
 *   }
 * }
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const matchId = url.searchParams.get('matchId');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Validate required fields
    if (!matchId) {
      return json(
        { error: 'Missing matchId' },
        { status: 400 }
      );
    }

    // Validate pagination parameters
    if (limit < 1 || limit > 100) {
      return json(
        { error: 'Limit must be between 1 and 100' },
        { status: 400 }
      );
    }

    if (offset < 0) {
      return json(
        { error: 'Offset must be non-negative' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Fetch total count
    const { count, error: countError } = await supabase
      .from('verified_vibe_messages')
      .select('*', { count: 'exact', head: true })
      .eq('match_id', matchId);

    if (countError) {
      console.error('Error counting messages:', countError);
      return json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    // Fetch messages
    const { data: messages, error: messagesError } = await supabase
      .from('verified_vibe_messages')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    const total = count || 0;
    const hasMore = offset + limit < total;

    return json({
      data: {
        messages: messages || [],
        total,
        hasMore
      }
    });
  } catch (error) {
    console.error('Message fetch error:', error);
    return json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
};

/**
 * POST /api/verified-vibe/message
 *
 * Sends a new message in a match conversation.
 * Validates message content, saves to Supabase, and returns the created message.
 *
 * Request body:
 * {
 *   matchId: string (required) - The match ID
 *   content: string (required) - The message content (1-5000 characters)
 *   senderId: string (required) - The sender's user ID
 * }
 *
 * Response:
 * {
 *   data: {
 *     message: Message
 *   }
 * }
 *
 * Error responses:
 * - 400: Missing or invalid required fields
 * - 401: Unauthorized (sender not part of match)
 * - 404: Match not found
 * - 500: Server error
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();

    const { matchId, content, senderId } = body;

    // Validate required fields
    if (!matchId) {
      return json(
        { error: 'Missing matchId' },
        { status: 400 }
      );
    }

    if (!content) {
      return json(
        { error: 'Missing content' },
        { status: 400 }
      );
    }

    if (!senderId) {
      return json(
        { error: 'Missing senderId' },
        { status: 400 }
      );
    }

    // Validate content
    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      return json(
        { error: 'Message content cannot be empty' },
        { status: 400 }
      );
    }

    if (trimmedContent.length > 5000) {
      return json(
        { error: 'Message content cannot exceed 5000 characters' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Verify match exists and sender is part of it
    const { data: match, error: matchError } = await supabase
      .from('verified_vibe_matches')
      .select('id, user1_id, user2_id')
      .eq('id', matchId)
      .single();

    if (matchError) {
      if (matchError.code === 'PGRST116') {
        // No rows found
        return json(
          { error: 'Match not found' },
          { status: 404 }
        );
      }
      console.error('Error fetching match:', matchError);
      return json(
        { error: 'Failed to verify match' },
        { status: 500 }
      );
    }

    // Verify sender is part of the match
    if (match.user1_id !== senderId && match.user2_id !== senderId) {
      return json(
        { error: 'Unauthorized: sender not part of this match' },
        { status: 401 }
      );
    }

    // Save message to Supabase
    const { data: newMessage, error: insertError } = await supabase
      .from('verified_vibe_messages')
      .insert({
        match_id: matchId,
        sender_id: senderId,
        content: trimmedContent,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error saving message:', insertError);
      return json(
        { error: 'Failed to save message' },
        { status: 500 }
      );
    }

    // Transform response to match Message interface
    const message: Message = {
      id: newMessage.id,
      matchId: newMessage.match_id,
      senderId: newMessage.sender_id,
      content: newMessage.content,
      createdAt: new Date(newMessage.created_at)
    };

    return json(
      { data: { message } },
      { status: 201 }
    );
  } catch (error) {
    console.error('Message send error:', error);
    return json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
};
