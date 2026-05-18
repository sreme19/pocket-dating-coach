import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { Message } from '$lib/verified-vibe/types';

interface SendMessageRequest {
  conversationId: string;
  content: string;
  mediaUrls?: string[];
}

interface SendMessageResponse {
  data: {
    message: Message;
  };
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
 *   mediaUrls?: string[] (optional media URLs)
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
    // Validate request method
    if (request.method !== 'POST') {
      return json(
        { error: 'Method not allowed' },
        { status: 405 }
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

    // In production, this would:
    // 1. Verify user is authenticated
    // 2. Verify user is part of the conversation
    // 3. Save message to database
    // 4. Trigger real-time update via WebSocket
    // 5. Create notification for recipient

    // Mock message creation
    const message: Message = {
      id: `msg_${Date.now()}`,
      matchId: body.conversationId,
      senderId: 'current_user_id', // In production, get from auth
      content: body.content.trim(),
      createdAt: new Date()
    };

    const response: SendMessageResponse = {
      data: {
        message
      }
    };

    return json(response, { status: 201 });
  } catch (error) {
    console.error('Send message error:', error);
    return json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
};
