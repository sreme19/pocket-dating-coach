import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './+server';

// Mock the request and response
function createMockRequest(body: any) {
  return {
    json: async () => body,
    method: 'POST'
  } as any;
}

describe('POST /api/verified-vibe/chat/notify', () => {
  describe('Valid Requests', () => {
    it('should create a message notification with all required fields', async () => {
      const body = {
        conversationId: 'conv_123',
        userId: 'user_456',
        senderId: 'user_789',
        senderName: 'John Doe',
        messagePreview: 'Hey, how are you?',
        isMuted: false
      };

      const request = createMockRequest(body);
      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.notification).toBeDefined();
      expect(data.notification.type).toBe('message');
      expect(data.notification.title).toContain('John Doe');
      expect(data.notification.body).toBe('Hey, how are you?');
    });

    it('should include sender photo in notification data', async () => {
      const body = {
        conversationId: 'conv_123',
        userId: 'user_456',
        senderId: 'user_789',
        senderName: 'Jane Smith',
        senderPhoto: 'https://example.com/photo.jpg',
        messagePreview: 'Hello!',
        isMuted: false
      };

      const request = createMockRequest(body);
      const response = await POST({ request } as any);
      const data = await response.json();

      expect(data.notification.data.userPhoto).toBe('https://example.com/photo.jpg');
    });

    it('should include action URL in notification data', async () => {
      const body = {
        conversationId: 'conv_123',
        userId: 'user_456',
        senderId: 'user_789',
        senderName: 'John Doe',
        messagePreview: 'Test message',
        isMuted: false
      };

      const request = createMockRequest(body);
      const response = await POST({ request } as any);
      const data = await response.json();

      expect(data.notification.data.actionUrl).toBe('/verified-vibe/chat/conv_123');
    });

    it('should set notification status to unread', async () => {
      const body = {
        conversationId: 'conv_123',
        userId: 'user_456',
        senderId: 'user_789',
        senderName: 'John Doe',
        messagePreview: 'Test message',
        isMuted: false
      };

      const request = createMockRequest(body);
      const response = await POST({ request } as any);
      const data = await response.json();

      expect(data.notification.status).toBe('unread');
    });

    it('should create notification even when muted', async () => {
      const body = {
        conversationId: 'conv_123',
        userId: 'user_456',
        senderId: 'user_789',
        senderName: 'John Doe',
        messagePreview: 'Test message',
        isMuted: true
      };

      const request = createMockRequest(body);
      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.notification).toBeDefined();
    });

    it('should generate unique notification IDs', async () => {
      const body = {
        conversationId: 'conv_123',
        userId: 'user_456',
        senderId: 'user_789',
        senderName: 'John Doe',
        messagePreview: 'Test message',
        isMuted: false
      };

      const request1 = createMockRequest(body);
      const response1 = await POST({ request: request1 } as any);
      const data1 = await response1.json();

      const request2 = createMockRequest(body);
      const response2 = await POST({ request: request2 } as any);
      const data2 = await response2.json();

      expect(data1.notification.id).not.toBe(data2.notification.id);
    });

    it('should include createdAt timestamp', async () => {
      const body = {
        conversationId: 'conv_123',
        userId: 'user_456',
        senderId: 'user_789',
        senderName: 'John Doe',
        messagePreview: 'Test message',
        isMuted: false
      };

      const request = createMockRequest(body);
      const response = await POST({ request } as any);
      const data = await response.json();

      expect(data.notification.createdAt).toBeDefined();
      expect(new Date(data.notification.createdAt)).toBeInstanceOf(Date);
    });

    it('should handle long sender names', async () => {
      const body = {
        conversationId: 'conv_123',
        userId: 'user_456',
        senderId: 'user_789',
        senderName: 'A'.repeat(100),
        messagePreview: 'Test message',
        isMuted: false
      };

      const request = createMockRequest(body);
      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
    });

    it('should handle special characters in message preview', async () => {
      const body = {
        conversationId: 'conv_123',
        userId: 'user_456',
        senderId: 'user_789',
        senderName: 'John Doe',
        messagePreview: 'Hey! 😊 How are you? <script>alert("xss")</script>',
        isMuted: false
      };

      const request = createMockRequest(body);
      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.notification.body).toContain('Hey! 😊');
    });
  });

  describe('Missing Fields', () => {
    it('should return 400 when conversationId is missing', async () => {
      const body = {
        userId: 'user_456',
        senderId: 'user_789',
        senderName: 'John Doe',
        messagePreview: 'Test message'
      };

      const request = createMockRequest(body);
      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing required fields');
    });

    it('should return 400 when userId is missing', async () => {
      const body = {
        conversationId: 'conv_123',
        senderId: 'user_789',
        senderName: 'John Doe',
        messagePreview: 'Test message'
      };

      const request = createMockRequest(body);
      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should return 400 when senderId is missing', async () => {
      const body = {
        conversationId: 'conv_123',
        userId: 'user_456',
        senderName: 'John Doe',
        messagePreview: 'Test message'
      };

      const request = createMockRequest(body);
      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should return 400 when senderName is missing', async () => {
      const body = {
        conversationId: 'conv_123',
        userId: 'user_456',
        senderId: 'user_789',
        messagePreview: 'Test message'
      };

      const request = createMockRequest(body);
      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should return 400 when messagePreview is missing', async () => {
      const body = {
        conversationId: 'conv_123',
        userId: 'user_456',
        senderId: 'user_789',
        senderName: 'John Doe'
      };

      const request = createMockRequest(body);
      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe('Invalid Field Types', () => {
    it('should return 400 when conversationId is not a string', async () => {
      const body = {
        conversationId: 123,
        userId: 'user_456',
        senderId: 'user_789',
        senderName: 'John Doe',
        messagePreview: 'Test message'
      };

      const request = createMockRequest(body);
      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid field types');
    });

    it('should return 400 when userId is not a string', async () => {
      const body = {
        conversationId: 'conv_123',
        userId: 456,
        senderId: 'user_789',
        senderName: 'John Doe',
        messagePreview: 'Test message'
      };

      const request = createMockRequest(body);
      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should return 400 when senderId is not a string', async () => {
      const body = {
        conversationId: 'conv_123',
        userId: 'user_456',
        senderId: 789,
        senderName: 'John Doe',
        messagePreview: 'Test message'
      };

      const request = createMockRequest(body);
      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should return 400 when senderName is not a string', async () => {
      const body = {
        conversationId: 'conv_123',
        userId: 'user_456',
        senderId: 'user_789',
        senderName: 123,
        messagePreview: 'Test message'
      };

      const request = createMockRequest(body);
      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should return 400 when messagePreview is not a string', async () => {
      const body = {
        conversationId: 'conv_123',
        userId: 'user_456',
        senderId: 'user_789',
        senderName: 'John Doe',
        messagePreview: 123
      };

      const request = createMockRequest(body);
      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe('Empty Strings', () => {
    it('should return 400 when conversationId is empty', async () => {
      const body = {
        conversationId: '',
        userId: 'user_456',
        senderId: 'user_789',
        senderName: 'John Doe',
        messagePreview: 'Test message'
      };

      const request = createMockRequest(body);
      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('should return 400 when userId is empty', async () => {
      const body = {
        conversationId: 'conv_123',
        userId: '',
        senderId: 'user_789',
        senderName: 'John Doe',
        messagePreview: 'Test message'
      };

      const request = createMockRequest(body);
      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('should return 400 when senderId is empty', async () => {
      const body = {
        conversationId: 'conv_123',
        userId: 'user_456',
        senderId: '',
        senderName: 'John Doe',
        messagePreview: 'Test message'
      };

      const request = createMockRequest(body);
      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('should return 400 when senderName is empty', async () => {
      const body = {
        conversationId: 'conv_123',
        userId: 'user_456',
        senderId: 'user_789',
        senderName: '',
        messagePreview: 'Test message'
      };

      const request = createMockRequest(body);
      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('should return 400 when messagePreview is empty', async () => {
      const body = {
        conversationId: 'conv_123',
        userId: 'user_456',
        senderId: 'user_789',
        senderName: 'John Doe',
        messagePreview: ''
      };

      const request = createMockRequest(body);
      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('should return 400 when messagePreview is only whitespace', async () => {
      const body = {
        conversationId: 'conv_123',
        userId: 'user_456',
        senderId: 'user_789',
        senderName: 'John Doe',
        messagePreview: '   '
      };

      const request = createMockRequest(body);
      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });

  describe('Message Preview Length', () => {
    it('should accept message preview up to 100 characters', async () => {
      const body = {
        conversationId: 'conv_123',
        userId: 'user_456',
        senderId: 'user_789',
        senderName: 'John Doe',
        messagePreview: 'A'.repeat(100),
        isMuted: false
      };

      const request = createMockRequest(body);
      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
    });

    it('should reject message preview exceeding 100 characters', async () => {
      const body = {
        conversationId: 'conv_123',
        userId: 'user_456',
        senderId: 'user_789',
        senderName: 'John Doe',
        messagePreview: 'A'.repeat(101),
        isMuted: false
      };

      const request = createMockRequest(body);
      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('exceeds maximum length');
    });
  });

  describe('Notification Data Structure', () => {
    it('should include matchId in notification data', async () => {
      const body = {
        conversationId: 'conv_123',
        userId: 'user_456',
        senderId: 'user_789',
        senderName: 'John Doe',
        messagePreview: 'Test message',
        isMuted: false
      };

      const request = createMockRequest(body);
      const response = await POST({ request } as any);
      const data = await response.json();

      expect(data.notification.data.matchId).toBe('conv_123');
    });

    it('should include userId in notification data', async () => {
      const body = {
        conversationId: 'conv_123',
        userId: 'user_456',
        senderId: 'user_789',
        senderName: 'John Doe',
        messagePreview: 'Test message',
        isMuted: false
      };

      const request = createMockRequest(body);
      const response = await POST({ request } as any);
      const data = await response.json();

      expect(data.notification.data.userId).toBe('user_789');
    });

    it('should include userName in notification data', async () => {
      const body = {
        conversationId: 'conv_123',
        userId: 'user_456',
        senderId: 'user_789',
        senderName: 'John Doe',
        messagePreview: 'Test message',
        isMuted: false
      };

      const request = createMockRequest(body);
      const response = await POST({ request } as any);
      const data = await response.json();

      expect(data.notification.data.userName).toBe('John Doe');
    });
  });

  describe('Error Handling', () => {
    it('should return 500 on JSON parse error', async () => {
      const request = {
        json: async () => {
          throw new Error('Invalid JSON');
        },
        method: 'POST'
      } as any;

      const response = await POST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });
});
