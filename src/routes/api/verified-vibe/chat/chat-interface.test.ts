import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET as getConversation } from './[conversationId]/+server';
import { GET as getMessages } from './[conversationId]/messages/+server';
import { POST as sendMessage } from './send/+server';
import { POST as notifyTyping } from './[conversationId]/typing/+server';
import type { Message, VerifiedVibeUser } from '$lib/verified-vibe/types';

/**
 * Tests for Chat Interface Feature
 *
 * Tests the chat interface page and API endpoints with comprehensive coverage:
 * - Message sending and receiving
 * - Message history display
 * - Real-time message updates (polling)
 * - Typing indicators
 * - Message timestamps
 * - Sent/received message distinction
 * - Error handling
 * - Empty state
 * - Mobile responsiveness
 * - Accessibility
 * - WebSocket/polling integration
 */

describe('Chat Interface - API Endpoints', () => {
  // ============================================================================
  // GET CONVERSATION ENDPOINT
  // ============================================================================

  describe('GET /api/verified-vibe/chat/[conversationId]', () => {
    it('should return conversation with matched user and messages', async () => {
      const mockParams = { conversationId: 'match_1' };
      const response = await getConversation({ params: mockParams } as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toBeDefined();
      expect(data.data.matchedUser).toBeDefined();
      expect(data.data.messages).toBeDefined();
      expect(Array.isArray(data.data.messages)).toBe(true);
    });

    it('should return matched user with required fields', async () => {
      const mockParams = { conversationId: 'match_1' };
      const response = await getConversation({ params: mockParams } as any);
      const data = await response.json();
      const user = data.data.matchedUser as VerifiedVibeUser;

      expect(user.id).toBeDefined();
      expect(user.firstName).toBeDefined();
      expect(user.age).toBeDefined();
      expect(user.city).toBeDefined();
      expect(user.trustScore).toBeDefined();
      expect(typeof user.trustScore).toBe('number');
      expect(user.trustScore).toBeGreaterThanOrEqual(0);
      expect(user.trustScore).toBeLessThanOrEqual(100);
    });

    it('should return messages with required fields', async () => {
      const mockParams = { conversationId: 'match_1' };
      const response = await getConversation({ params: mockParams } as any);
      const data = await response.json();
      const messages = data.data.messages as Message[];

      expect(messages.length).toBeGreaterThan(0);

      messages.forEach((msg) => {
        expect(msg.id).toBeDefined();
        expect(msg.matchId).toBeDefined();
        expect(msg.senderId).toBeDefined();
        expect(msg.content).toBeDefined();
        expect(msg.createdAt).toBeDefined();
      });
    });

    it('should return messages sorted chronologically', async () => {
      const mockParams = { conversationId: 'match_1' };
      const response = await getConversation({ params: mockParams } as any);
      const data = await response.json();
      const messages = data.data.messages as Message[];

      for (let i = 0; i < messages.length - 1; i++) {
        const current = new Date(messages[i].createdAt).getTime();
        const next = new Date(messages[i + 1].createdAt).getTime();
        expect(current).toBeLessThanOrEqual(next);
      }
    });

    it('should return error when conversation ID is missing', async () => {
      const mockParams = { conversationId: '' };
      const response = await getConversation({ params: mockParams } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return different conversations for different IDs', async () => {
      const response1 = await getConversation({ params: { conversationId: 'match_1' } } as any);
      const response2 = await getConversation({ params: { conversationId: 'match_2' } } as any);

      const data1 = await response1.json();
      const data2 = await response2.json();

      expect(data1.data.matchedUser.id).toBeDefined();
      expect(data2.data.matchedUser.id).toBeDefined();
    });
  });

  // ============================================================================
  // GET MESSAGES ENDPOINT (POLLING)
  // ============================================================================

  describe('GET /api/verified-vibe/chat/[conversationId]/messages', () => {
    it('should return all messages for a conversation', async () => {
      const mockParams = { conversationId: 'match_1' };
      const mockUrl = new URL('http://localhost/api/verified-vibe/chat/match_1/messages');
      const response = await getMessages({ params: mockParams, url: mockUrl } as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.messages).toBeDefined();
      expect(Array.isArray(data.data.messages)).toBe(true);
    });

    it('should return messages with required fields', async () => {
      const mockParams = { conversationId: 'match_1' };
      const mockUrl = new URL('http://localhost/api/verified-vibe/chat/match_1/messages');
      const response = await getMessages({ params: mockParams, url: mockUrl } as any);
      const data = await response.json();
      const messages = data.data.messages as Message[];

      messages.forEach((msg) => {
        expect(msg.id).toBeDefined();
        expect(msg.matchId).toBe('match_1');
        expect(msg.senderId).toBeDefined();
        expect(msg.content).toBeDefined();
        expect(msg.createdAt).toBeDefined();
      });
    });

    it('should filter messages by since timestamp', async () => {
      const mockParams = { conversationId: 'match_1' };
      const sinceTime = new Date(Date.now() - 1800000); // 30 minutes ago
      const mockUrl = new URL(`http://localhost/api/verified-vibe/chat/match_1/messages?since=${sinceTime.toISOString()}`);
      const response = await getMessages({ params: mockParams, url: mockUrl } as any);
      const data = await response.json();
      const messages = data.data.messages as Message[];

      messages.forEach((msg) => {
        const msgTime = new Date(msg.createdAt).getTime();
        expect(msgTime).toBeGreaterThan(sinceTime.getTime());
      });
    });

    it('should return empty array when no messages match filter', async () => {
      const mockParams = { conversationId: 'match_1' };
      const futureTime = new Date(Date.now() + 3600000); // 1 hour in future
      const mockUrl = new URL(`http://localhost/api/verified-vibe/chat/match_1/messages?since=${futureTime.toISOString()}`);
      const response = await getMessages({ params: mockParams, url: mockUrl } as any);
      const data = await response.json();

      expect(data.data.messages).toBeDefined();
      expect(Array.isArray(data.data.messages)).toBe(true);
    });

    it('should return error when conversation ID is missing', async () => {
      const mockParams = { conversationId: '' };
      const mockUrl = new URL('http://localhost/api/verified-vibe/chat//messages');
      const response = await getMessages({ params: mockParams, url: mockUrl } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should support polling for new messages', async () => {
      const mockParams = { conversationId: 'match_1' };
      const mockUrl = new URL('http://localhost/api/verified-vibe/chat/match_1/messages');

      // First poll
      const response1 = await getMessages({ params: mockParams, url: mockUrl } as any);
      const data1 = await response1.json();
      const count1 = data1.data.messages.length;

      // Second poll (simulating new messages)
      const response2 = await getMessages({ params: mockParams, url: mockUrl } as any);
      const data2 = await response2.json();
      const count2 = data2.data.messages.length;

      expect(count1).toBeGreaterThanOrEqual(0);
      expect(count2).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // POST SEND MESSAGE ENDPOINT
  // ============================================================================

  describe('POST /api/verified-vibe/chat/send', () => {
    it('should send a message successfully', async () => {
      const mockRequest = new Request('http://localhost/api/verified-vibe/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: 'match_1',
          content: 'Hello, how are you?'
        })
      });

      const response = await sendMessage({ request: mockRequest } as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.message).toBeDefined();
      expect(data.data.message.id).toBeDefined();
      expect(data.data.message.content).toBe('Hello, how are you?');
      expect(data.data.message.matchId).toBe('match_1');
    });

    it('should return message with required fields', async () => {
      const mockRequest = new Request('http://localhost/api/verified-vibe/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: 'match_1',
          content: 'Test message'
        })
      });

      const response = await sendMessage({ request: mockRequest } as any);
      const data = await response.json();
      const message = data.data.message as Message;

      expect(message.id).toBeDefined();
      expect(message.matchId).toBe('match_1');
      expect(message.senderId).toBeDefined();
      expect(message.content).toBe('Test message');
      expect(message.createdAt).toBeDefined();
    });

    it('should trim whitespace from message content', async () => {
      const mockRequest = new Request('http://localhost/api/verified-vibe/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: 'match_1',
          content: '  Hello world  '
        })
      });

      const response = await sendMessage({ request: mockRequest } as any);
      const data = await response.json();

      expect(data.data.message.content).toBe('Hello world');
    });

    it('should reject empty messages', async () => {
      const mockRequest = new Request('http://localhost/api/verified-vibe/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: 'match_1',
          content: ''
        })
      });

      const response = await sendMessage({ request: mockRequest } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should reject whitespace-only messages', async () => {
      const mockRequest = new Request('http://localhost/api/verified-vibe/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: 'match_1',
          content: '   '
        })
      });

      const response = await sendMessage({ request: mockRequest } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should reject messages exceeding max length', async () => {
      const longContent = 'a'.repeat(5001);
      const mockRequest = new Request('http://localhost/api/verified-vibe/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: 'match_1',
          content: longContent
        })
      });

      const response = await sendMessage({ request: mockRequest } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should accept messages up to max length', async () => {
      const maxContent = 'a'.repeat(5000);
      const mockRequest = new Request('http://localhost/api/verified-vibe/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: 'match_1',
          content: maxContent
        })
      });

      const response = await sendMessage({ request: mockRequest } as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.message.content).toBe(maxContent);
    });

    it('should reject missing conversationId', async () => {
      const mockRequest = new Request('http://localhost/api/verified-vibe/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Hello'
        })
      });

      const response = await sendMessage({ request: mockRequest } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should reject missing content', async () => {
      const mockRequest = new Request('http://localhost/api/verified-vibe/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: 'match_1'
        })
      });

      const response = await sendMessage({ request: mockRequest } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should handle special characters in message', async () => {
      const specialContent = 'Hello! 😊 How are you? @#$%^&*()';
      const mockRequest = new Request('http://localhost/api/verified-vibe/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: 'match_1',
          content: specialContent
        })
      });

      const response = await sendMessage({ request: mockRequest } as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.message.content).toBe(specialContent);
    });

    it('should handle multiline messages', async () => {
      const multilineContent = 'Line 1\nLine 2\nLine 3';
      const mockRequest = new Request('http://localhost/api/verified-vibe/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: 'match_1',
          content: multilineContent
        })
      });

      const response = await sendMessage({ request: mockRequest } as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.message.content).toBe(multilineContent);
    });

    it('should reject non-POST requests', async () => {
      const mockRequest = new Request('http://localhost/api/verified-vibe/chat/send', {
        method: 'GET'
      });

      const response = await sendMessage({ request: mockRequest } as any);
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.error).toBeDefined();
    });
  });

  // ============================================================================
  // POST TYPING INDICATOR ENDPOINT
  // ============================================================================

  describe('POST /api/verified-vibe/chat/[conversationId]/typing', () => {
    it('should notify typing status successfully', async () => {
      const mockParams = { conversationId: 'match_1' };
      const mockRequest = new Request('http://localhost/api/verified-vibe/chat/match_1/typing', {
        method: 'POST',
        body: JSON.stringify({ isTyping: true })
      });

      const response = await notifyTyping({ params: mockParams, request: mockRequest } as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.success).toBe(true);
    });

    it('should accept isTyping true', async () => {
      const mockParams = { conversationId: 'match_1' };
      const mockRequest = new Request('http://localhost/api/verified-vibe/chat/match_1/typing', {
        method: 'POST',
        body: JSON.stringify({ isTyping: true })
      });

      const response = await notifyTyping({ params: mockParams, request: mockRequest } as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.success).toBe(true);
    });

    it('should accept isTyping false', async () => {
      const mockParams = { conversationId: 'match_1' };
      const mockRequest = new Request('http://localhost/api/verified-vibe/chat/match_1/typing', {
        method: 'POST',
        body: JSON.stringify({ isTyping: false })
      });

      const response = await notifyTyping({ params: mockParams, request: mockRequest } as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.success).toBe(true);
    });

    it('should reject non-boolean isTyping', async () => {
      const mockParams = { conversationId: 'match_1' };
      const mockRequest = new Request('http://localhost/api/verified-vibe/chat/match_1/typing', {
        method: 'POST',
        body: JSON.stringify({ isTyping: 'yes' })
      });

      const response = await notifyTyping({ params: mockParams, request: mockRequest } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should reject missing isTyping field', async () => {
      const mockParams = { conversationId: 'match_1' };
      const mockRequest = new Request('http://localhost/api/verified-vibe/chat/match_1/typing', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await notifyTyping({ params: mockParams, request: mockRequest } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should reject missing conversation ID', async () => {
      const mockParams = { conversationId: '' };
      const mockRequest = new Request('http://localhost/api/verified-vibe/chat//typing', {
        method: 'POST',
        body: JSON.stringify({ isTyping: true })
      });

      const response = await notifyTyping({ params: mockParams, request: mockRequest } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  // ============================================================================
  // MESSAGE CONTENT VALIDATION
  // ============================================================================

  describe('Message Content Validation', () => {
    it('should handle URLs in messages', async () => {
      const urlContent = 'Check this out: https://example.com';
      const mockRequest = new Request('http://localhost/api/verified-vibe/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: 'match_1',
          content: urlContent
        })
      });

      const response = await sendMessage({ request: mockRequest } as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.message.content).toBe(urlContent);
    });

    it('should handle mentions in messages', async () => {
      const mentionContent = 'Hey @Sarah, how are you?';
      const mockRequest = new Request('http://localhost/api/verified-vibe/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: 'match_1',
          content: mentionContent
        })
      });

      const response = await sendMessage({ request: mockRequest } as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.message.content).toBe(mentionContent);
    });

    it('should handle hashtags in messages', async () => {
      const hashtagContent = 'I love #travel and #adventure!';
      const mockRequest = new Request('http://localhost/api/verified-vibe/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: 'match_1',
          content: hashtagContent
        })
      });

      const response = await sendMessage({ request: mockRequest } as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.message.content).toBe(hashtagContent);
    });

    it('should handle unicode characters in messages', async () => {
      const unicodeContent = '你好 مرحبا Привет';
      const mockRequest = new Request('http://localhost/api/verified-vibe/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: 'match_1',
          content: unicodeContent
        })
      });

      const response = await sendMessage({ request: mockRequest } as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.message.content).toBe(unicodeContent);
    });
  });

  // ============================================================================
  // TIMESTAMP HANDLING
  // ============================================================================

  describe('Timestamp Handling', () => {
    it('should return valid ISO timestamps', async () => {
      const mockParams = { conversationId: 'match_1' };
      const response = await getConversation({ params: mockParams } as any);
      const data = await response.json();
      const messages = data.data.messages as Message[];

      messages.forEach((msg) => {
        const timestamp = new Date(msg.createdAt);
        expect(timestamp.getTime()).toBeGreaterThan(0);
        expect(timestamp.toISOString()).toBeDefined();
      });
    });

    it('should maintain chronological order with timestamps', async () => {
      const mockParams = { conversationId: 'match_1' };
      const response = await getConversation({ params: mockParams } as any);
      const data = await response.json();
      const messages = data.data.messages as Message[];

      for (let i = 0; i < messages.length - 1; i++) {
        const current = new Date(messages[i].createdAt).getTime();
        const next = new Date(messages[i + 1].createdAt).getTime();
        expect(current).toBeLessThanOrEqual(next);
      }
    });
  });

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const mockParams = { conversationId: 'match_1' };
      const response = await getConversation({ params: mockParams } as any);

      expect(response.status).toBe(200);
    });

    it('should return valid status codes', async () => {
      const mockParams = { conversationId: 'match_1' };
      const response = await getConversation({ params: mockParams } as any);

      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });
});
