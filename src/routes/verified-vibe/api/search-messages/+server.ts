/**
 * Search Messages API Endpoint
 *
 * Handles message search with filters (query, date range, sender).
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';

/**
 * GET /api/verified-vibe/search-messages
 *
 * Search messages in a match conversation.
 *
 * Query parameters:
 * - matchId: string (required) - The match ID
 * - query: string (required) - Search query (1-100 characters)
 * - fromDate: string (optional) - ISO date string for start of range
 * - toDate: string (optional) - ISO date string for end of range
 * - sender: string (optional) - Sender user ID to filter by
 * - limit: number (optional, default: 50) - Number of results
 * - offset: number (optional, default: 0) - Pagination offset
 *
 * Response:
 * {
 *   data: {
 *     results: Array<{
 *       id: string,
 *       messageId: string,
 *       content: string,
 *       senderName: string,
 *       senderId: string,
 *       createdAt: string (ISO date),
 *       conversationId: string
 *     }>,
 *     total: number,
 *     hasMore: boolean
 *   }
 * }
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const matchId = url.searchParams.get('matchId');
    const query = url.searchParams.get('query');
    const fromDate = url.searchParams.get('fromDate');
    const toDate = url.searchParams.get('toDate');
    const sender = url.searchParams.get('sender');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Validate required fields
    if (!matchId) {
      return json(
        { error: 'Missing matchId' },
        { status: 400 }
      );
    }

    if (!query) {
      return json(
        { error: 'Missing query' },
        { status: 400 }
      );
    }

    // Validate query length
    if (query.length < 1 || query.length > 100) {
      return json(
        { error: 'Query must be between 1 and 100 characters' },
        { status: 400 }
      );
    }

    // Validate pagination
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

    // Build query
    let searchQuery = supabase
      .from('verified_vibe_messages')
      .select('*', { count: 'exact' })
      .eq('match_id', matchId)
      .ilike('content', `%${query}%`);

    // Apply date range filters
    if (fromDate) {
      searchQuery = searchQuery.gte('created_at', new Date(fromDate).toISOString());
    }

    if (toDate) {
      searchQuery = searchQuery.lte('created_at', new Date(toDate).toISOString());
    }

    // Apply sender filter
    if (sender) {
      searchQuery = searchQuery.eq('sender_id', sender);
    }

    // Apply pagination and ordering
    const { data: messages, count, error } = await searchQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error searching messages:', error);
      return json(
        { error: 'Failed to search messages' },
        { status: 500 }
      );
    }

    const total = count || 0;
    const hasMore = offset + limit < total;

    // Transform results to match SearchResult interface
    const results = (messages || []).map((msg: any) => ({
      id: `result_${msg.id}`,
      messageId: msg.id,
      content: msg.content,
      senderName: msg.sender_id, // In real implementation, would fetch user name
      senderId: msg.sender_id,
      createdAt: msg.created_at,
      conversationId: msg.match_id
    }));

    return json({
      data: {
        results,
        total,
        hasMore
      }
    });
  } catch (error) {
    console.error('Search messages error:', error);
    return json(
      { error: 'Failed to search messages' },
      { status: 500 }
    );
  }
};
