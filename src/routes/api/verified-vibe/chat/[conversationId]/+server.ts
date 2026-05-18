import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { Message, VerifiedVibeUser } from '$lib/verified-vibe/types';

interface ConversationResponse {
  data: {
    matchedUser: VerifiedVibeUser;
    messages: Message[];
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
export const GET: RequestHandler = async ({ params }) => {
  try {
    const conversationId = params.conversationId;

    if (!conversationId) {
      return json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }

    // In production, this would:
    // 1. Verify user is authenticated
    // 2. Verify user is part of the conversation
    // 3. Fetch matched user info
    // 4. Fetch message history from database
    // 5. Mark messages as read

    // Mock data for conversation
    const mockMatchedUser: VerifiedVibeUser = {
      id: 'user_1',
      gender: 'woman',
      archetype: 'spoilt_woman',
      firstName: 'Sarah',
      age: 26,
      city: 'Brooklyn, NY',
      avatar: null,
      about: 'Looking for someone genuine and ambitious.',
      looking: 'Long-term relationship',
      trustScore: 88,
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15')
    };

    const mockMessages: Message[] = [
      {
        id: 'msg_1',
        matchId: conversationId,
        senderId: 'user_1',
        content: 'Hey! How are you doing?',
        createdAt: new Date(Date.now() - 3600000)
      },
      {
        id: 'msg_2',
        matchId: conversationId,
        senderId: 'current_user_id',
        content: 'Hi Sarah! I\'m doing great, thanks for asking!',
        createdAt: new Date(Date.now() - 3500000)
      },
      {
        id: 'msg_3',
        matchId: conversationId,
        senderId: 'user_1',
        content: 'That\'s awesome! What have you been up to?',
        createdAt: new Date(Date.now() - 3400000)
      },
      {
        id: 'msg_4',
        matchId: conversationId,
        senderId: 'current_user_id',
        content: 'Just finished a project at work. Feeling pretty accomplished!',
        createdAt: new Date(Date.now() - 3300000)
      },
      {
        id: 'msg_5',
        matchId: conversationId,
        senderId: 'user_1',
        content: 'That sounds amazing! I love ambitious people.',
        createdAt: new Date(Date.now() - 3200000)
      },
      {
        id: 'msg_6',
        matchId: conversationId,
        senderId: 'current_user_id',
        content: 'Thanks! What about you? What do you do?',
        createdAt: new Date(Date.now() - 3100000)
      },
      {
        id: 'msg_7',
        matchId: conversationId,
        senderId: 'user_1',
        content: 'I\'m a marketing manager at a tech startup. It\'s been a wild ride!',
        createdAt: new Date(Date.now() - 3000000)
      },
      {
        id: 'msg_8',
        matchId: conversationId,
        senderId: 'current_user_id',
        content: 'That\'s so cool! I\'d love to hear more about it.',
        createdAt: new Date(Date.now() - 2900000)
      },
      {
        id: 'msg_9',
        matchId: conversationId,
        senderId: 'user_1',
        content: 'For sure! Maybe we could grab coffee and chat about it?',
        createdAt: new Date(Date.now() - 2800000)
      },
      {
        id: 'msg_10',
        matchId: conversationId,
        senderId: 'current_user_id',
        content: 'I\'d love that! When are you free?',
        createdAt: new Date(Date.now() - 2700000)
      }
    ];

    const response: ConversationResponse = {
      data: {
        matchedUser: mockMatchedUser,
        messages: mockMessages
      }
    };

    return json(response);
  } catch (error) {
    console.error('Conversation fetch error:', error);
    return json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
};
