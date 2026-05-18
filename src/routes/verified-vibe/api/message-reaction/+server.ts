/**
 * Message Reaction API Endpoint
 *
 * Handles message reactions (emoji reactions).
 * Allows adding and removing reactions to messages.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * POST /api/verified-vibe/message-reaction
 *
 * Add or remove a reaction to a message.
 *
 * Request body:
 * {
 *   conversationId: string (required) - The conversation ID
 *   messageId: string (required) - The message ID
 *   userId: string (required) - The user ID
 *   emoji: string (required) - The emoji to react with
 *   action: 'add' | 'remove' (required) - Add or remove reaction
 * }
 *
 * Response:
 * {
 *   data: {
 *     success: boolean,
 *     messageId: string,
 *     emoji: string,
 *     action: string,
 *     reactions: Array<{
 *       emoji: string,
 *       users: string[],
 *       count: number
 *     }>
 *   }
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();

    const { conversationId, messageId, userId, emoji, action } = body;

    // Validate required fields
    if (!conversationId) {
      return json(
        { error: 'Missing conversationId' },
        { status: 400 }
      );
    }

    if (!messageId) {
      return json(
        { error: 'Missing messageId' },
        { status: 400 }
      );
    }

    if (!userId) {
      return json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    if (!emoji) {
      return json(
        { error: 'Missing emoji' },
        { status: 400 }
      );
    }

    if (!['add', 'remove'].includes(action)) {
      return json(
        { error: 'action must be "add" or "remove"' },
        { status: 400 }
      );
    }

    // In a real implementation, you would:
    // 1. Verify user is part of conversation
    // 2. Check if message exists
    // 3. Add or remove reaction in database
    // 4. Broadcast reaction change via WebSocket

    console.log(`[Message Reaction API] ${action} reaction ${emoji} on message ${messageId} by ${userId}`);

    return json({
      data: {
        success: true,
        messageId,
        emoji,
        action,
        reactions: []
      }
    });
  } catch (error) {
    console.error('Message Reaction API error:', error);
    return json(
      { error: 'Failed to process reaction' },
      { status: 500 }
    );
  }
};

/**
 * GET /api/verified-vibe/message-reaction
 *
 * Get reactions for a message.
 *
 * Query parameters:
 * - conversationId: string (required) - The conversation ID
 * - messageId: string (required) - The message ID
 *
 * Response:
 * {
 *   data: {
 *     reactions: Array<{
 *       emoji: string,
 *       users: string[],
 *       count: number
 *     }>
 *   }
 * }
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const conversationId = url.searchParams.get('conversationId');
    const messageId = url.searchParams.get('messageId');

    // Validate required fields
    if (!conversationId || !messageId) {
      return json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // In a real implementation, you would:
    // 1. Query reactions from database
    // 2. Return list of reactions with user counts

    return json({
      data: {
        reactions: []
      }
    });
  } catch (error) {
    console.error('Message Reaction API error:', error);
    return json(
      { error: 'Failed to fetch reactions' },
      { status: 500 }
    );
  }
};
