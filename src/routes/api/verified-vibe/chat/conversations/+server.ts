import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { Message, VerifiedVibeUser } from '$lib/verified-vibe/types';

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
export const GET: RequestHandler = async ({ url }) => {
  try {
    // Mock data for conversations
    // In production, this would query the database for the current user's conversations
    const mockConversations: Conversation[] = [
      {
        id: 'conv_1',
        matchId: 'match_1',
        matchedUser: {
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
        },
        lastMessage: 'That sounds amazing! When are you free?',
        lastMessageTime: new Date(Date.now() - 300000), // 5 minutes ago
        unreadCount: 2
      },
      {
        id: 'conv_2',
        matchId: 'match_2',
        matchedUser: {
          id: 'user_2',
          gender: 'woman',
          archetype: 'safety_first_woman',
          firstName: 'Jessica',
          age: 28,
          city: 'Williamsburg, NY',
          avatar: null,
          about: 'Entrepreneur with a passion for travel.',
          looking: 'Long-term relationship',
          trustScore: 92,
          createdAt: new Date('2024-01-20'),
          updatedAt: new Date('2024-01-20')
        },
        lastMessage: 'I had a great time chatting with you!',
        lastMessageTime: new Date(Date.now() - 3600000), // 1 hour ago
        unreadCount: 0
      },
      {
        id: 'conv_3',
        matchId: 'match_3',
        matchedUser: {
          id: 'user_3',
          gender: 'woman',
          archetype: 'spoilt_woman',
          firstName: 'Emma',
          age: 24,
          city: 'Manhattan, NY',
          avatar: null,
          about: 'Creative professional seeking meaningful connections.',
          looking: 'Casual dating',
          trustScore: 76,
          createdAt: new Date('2024-01-10'),
          updatedAt: new Date('2024-01-10')
        },
        lastMessage: 'Hey! How was your day?',
        lastMessageTime: new Date(Date.now() - 7200000), // 2 hours ago
        unreadCount: 1
      },
      {
        id: 'conv_4',
        matchId: 'match_4',
        matchedUser: {
          id: 'user_4',
          gender: 'woman',
          archetype: 'safety_first_woman',
          firstName: 'Amanda',
          age: 25,
          city: 'Park Slope, NY',
          avatar: null,
          about: 'Artist and yoga instructor.',
          looking: 'Long-term relationship',
          trustScore: 81,
          createdAt: new Date('2024-01-18'),
          updatedAt: new Date('2024-01-18')
        },
        lastMessage: 'Would love to grab coffee sometime!',
        lastMessageTime: new Date(Date.now() - 86400000), // 1 day ago
        unreadCount: 0
      },
      {
        id: 'conv_5',
        matchId: 'match_5',
        matchedUser: {
          id: 'user_5',
          gender: 'woman',
          archetype: 'spoilt_woman',
          firstName: 'Rachel',
          age: 27,
          city: 'Upper West Side, NY',
          avatar: null,
          about: 'Lawyer by day, foodie by night.',
          looking: 'Long-term relationship',
          trustScore: 85,
          createdAt: new Date('2024-01-12'),
          updatedAt: new Date('2024-01-12')
        },
        lastMessage: 'That restaurant was incredible!',
        lastMessageTime: new Date(Date.now() - 172800000), // 2 days ago
        unreadCount: 0
      }
    ];

    // Sort by most recent message first
    const sorted = mockConversations.sort(
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
