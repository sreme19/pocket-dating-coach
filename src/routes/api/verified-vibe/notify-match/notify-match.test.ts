import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './+server';
import type { RequestHandler } from '@sveltejs/kit';

/**
 * Tests for POST /api/verified-vibe/notify-match
 *
 * Tests the match notification API endpoint with comprehensive coverage:
 * - Valid notification creation
 * - Missing required fields
 * - Invalid field types
 * - Notification structure validation
 * - Error handling
 * - Push notification support
 * - Notification data integrity
 */

describe('POST /api/verified-vibe/notify-match', () => {
  let mockRequest: any;

  beforeEach(() => {
    mockRequest = {
      json: vi.fn()
    };
  });

  // ============================================================================
  // VALID NOTIFICATION CREATION
  // ============================================================================

  it('should create a notification with all required fields', async () => {
    const requestBody = {
      matchId: 'match_123',
      userId: 'user_456',
      matchedUserId: 'user_789',
      matchedUserName: 'Sarah'
    };

    mockRequest.json.mockResolvedValue(requestBody);

    const response = await POST({ request: mockRequest } as any);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.notification).toBeDefined();
    expect(data.notification.id).toBeDefined();
    expect(data.notification.userId).toBe('user_456');
    expect(data.notification.type).toBe('match');
    expect(data.notification.status).toBe('unread');
  });

  it('should create a notification with matched user photo', async () => {
    const requestBody = {
      matchId: 'match_123',
      userId: 'user_456',
      matchedUserId: 'user_789',
      matchedUserName: 'Sarah',
      matchedUserPhoto: 'https://example.com/photo.jpg'
    };

    mockRequest.json.mockResolvedValue(requestBody);

    const response = await POST({ request: mockRequest } as any);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.notification.data.userPhoto).toBe('https://example.com/photo.jpg');
  });

  it('should include matched user name in notification body', async () => {
    const requestBody = {
      matchId: 'match_123',
      userId: 'user_456',
      matchedUserId: 'user_789',
      matchedUserName: 'Emma'
    };

    mockRequest.json.mockResolvedValue(requestBody);

    const response = await POST({ request: mockRequest } as any);
    const data = await response.json();

    expect(data.notification.body).toContain('Emma');
    expect(data.notification.body).toContain('matched');
  });

  it('should set notification title to "New Match!"', async () => {
    const requestBody = {
      matchId: 'match_123',
      userId: 'user_456',
      matchedUserId: 'user_789',
      matchedUserName: 'Jessica'
    };

    mockRequest.json.mockResolvedValue(requestBody);

    const response = await POST({ request: mockRequest } as any);
    const data = await response.json();

    expect(data.notification.title).toBe('New Match!');
  });

  it('should include action URL for opening chat', async () => {
    const requestBody = {
      matchId: 'match_123',
      userId: 'user_456',
      matchedUserId: 'user_789',
      matchedUserName: 'Sarah'
    };

    mockRequest.json.mockResolvedValue(requestBody);

    const response = await POST({ request: mockRequest } as any);
    const data = await response.json();

    expect(data.notification.data.actionUrl).toBe('/verified-vibe/chat/match_123');
  });

  it('should include match ID in notification data', async () => {
    const requestBody = {
      matchId: 'match_abc123',
      userId: 'user_456',
      matchedUserId: 'user_789',
      matchedUserName: 'Sarah'
    };

    mockRequest.json.mockResolvedValue(requestBody);

    const response = await POST({ request: mockRequest } as any);
    const data = await response.json();

    expect(data.notification.data.matchId).toBe('match_abc123');
  });

  it('should include matched user ID in notification data', async () => {
    const requestBody = {
      matchId: 'match_123',
      userId: 'user_456',
      matchedUserId: 'user_xyz789',
      matchedUserName: 'Sarah'
    };

    mockRequest.json.mockResolvedValue(requestBody);

    const response = await POST({ request: mockRequest } as any);
    const data = await response.json();

    expect(data.notification.data.userId).toBe('user_xyz789');
  });

  it('should set notification status to unread', async () => {
    const requestBody = {
      matchId: 'match_123',
      userId: 'user_456',
      matchedUserId: 'user_789',
      matchedUserName: 'Sarah'
    };

    mockRequest.json.mockResolvedValue(requestBody);

    const response = await POST({ request: mockRequest } as any);
    const data = await response.json();

    expect(data.notification.status).toBe('unread');
  });

  it('should set notification type to match', async () => {
    const requestBody = {
      matchId: 'match_123',
      userId: 'user_456',
      matchedUserId: 'user_789',
      matchedUserName: 'Sarah'
    };

    mockRequest.json.mockResolvedValue(requestBody);

    const response = await POST({ request: mockRequest } as any);
    const data = await response.json();

    expect(data.notification.type).toBe('match');
  });

  it('should include creation timestamp', async () => {
    const requestBody = {
      matchId: 'match_123',
      userId: 'user_456',
      matchedUserId: 'user_789',
      matchedUserName: 'Sarah'
    };

    mockRequest.json.mockResolvedValue(requestBody);

    const response = await POST({ request: mockRequest } as any);
    const data = await response.json();

    expect(data.notification.createdAt).toBeDefined();
    expect(new Date(data.notification.createdAt)).toBeInstanceOf(Date);
  });

  it('should generate unique notification IDs', async () => {
    const requestBody = {
      matchId: 'match_123',
      userId: 'user_456',
      matchedUserId: 'user_789',
      matchedUserName: 'Sarah'
    };

    mockRequest.json.mockResolvedValue(requestBody);

    const response1 = await POST({ request: mockRequest } as any);
    const data1 = await response1.json();

    mockRequest.json.mockResolvedValue(requestBody);
    const response2 = await POST({ request: mockRequest } as any);
    const data2 = await response2.json();

    expect(data1.notification.id).not.toBe(data2.notification.id);
  });

  // ============================================================================
  // MISSING REQUIRED FIELDS
  // ============================================================================

  it('should return 400 when matchId is missing', async () => {
    const requestBody = {
      userId: 'user_456',
      matchedUserId: 'user_789',
      matchedUserName: 'Sarah'
    };

    mockRequest.json.mockResolvedValue(requestBody);

    const response = await POST({ request: mockRequest } as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('required');
  });

  it('should return 400 when userId is missing', async () => {
    const requestBody = {
      matchId: 'match_123',
      matchedUserId: 'user_789',
      matchedUserName: 'Sarah'
    };

    mockRequest.json.mockResolvedValue(requestBody);

    const response = await POST({ request: mockRequest } as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('should return 400 when matchedUserId is missing', async () => {
    const requestBody = {
      matchId: 'match_123',
      userId: 'user_456',
      matchedUserName: 'Sarah'
    };

    mockRequest.json.mockResolvedValue(requestBody);

    const response = await POST({ request: mockRequest } as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('should return 400 when matchedUserName is missing', async () => {
    const requestBody = {
      matchId: 'match_123',
      userId: 'user_456',
      matchedUserId: 'user_789'
    };

    mockRequest.json.mockResolvedValue(requestBody);

    const response = await POST({ request: mockRequest } as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  // ============================================================================
  // INVALID FIELD TYPES
  // ============================================================================

  it('should return 400 when matchId is not a string', async () => {
    const requestBody = {
      matchId: 123,
      userId: 'user_456',
      matchedUserId: 'user_789',
      matchedUserName: 'Sarah'
    };

    mockRequest.json.mockResolvedValue(requestBody);

    const response = await POST({ request: mockRequest } as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('should return 400 when userId is not a string', async () => {
    const requestBody = {
      matchId: 'match_123',
      userId: 456,
      matchedUserId: 'user_789',
      matchedUserName: 'Sarah'
    };

    mockRequest.json.mockResolvedValue(requestBody);

    const response = await POST({ request: mockRequest } as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('should return 400 when matchedUserId is not a string', async () => {
    const requestBody = {
      matchId: 'match_123',
      userId: 'user_456',
      matchedUserId: 789,
      matchedUserName: 'Sarah'
    };

    mockRequest.json.mockResolvedValue(requestBody);

    const response = await POST({ request: mockRequest } as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('should return 400 when matchedUserName is not a string', async () => {
    const requestBody = {
      matchId: 'match_123',
      userId: 'user_456',
      matchedUserId: 'user_789',
      matchedUserName: 123
    };

    mockRequest.json.mockResolvedValue(requestBody);

    const response = await POST({ request: mockRequest } as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  it('should return 500 on JSON parse error', async () => {
    mockRequest.json.mockRejectedValue(new Error('Invalid JSON'));

    const response = await POST({ request: mockRequest } as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });

  it('should return 500 on unexpected error', async () => {
    mockRequest.json.mockRejectedValue(new Error('Unexpected error'));

    const response = await POST({ request: mockRequest } as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
  });

  // ============================================================================
  // RESPONSE STRUCTURE
  // ============================================================================

  it('should return success flag in response', async () => {
    const requestBody = {
      matchId: 'match_123',
      userId: 'user_456',
      matchedUserId: 'user_789',
      matchedUserName: 'Sarah'
    };

    mockRequest.json.mockResolvedValue(requestBody);

    const response = await POST({ request: mockRequest } as any);
    const data = await response.json();

    expect(data).toHaveProperty('success');
    expect(typeof data.success).toBe('boolean');
  });

  it('should return notification object on success', async () => {
    const requestBody = {
      matchId: 'match_123',
      userId: 'user_456',
      matchedUserId: 'user_789',
      matchedUserName: 'Sarah'
    };

    mockRequest.json.mockResolvedValue(requestBody);

    const response = await POST({ request: mockRequest } as any);
    const data = await response.json();

    expect(data).toHaveProperty('notification');
    expect(data.notification).toHaveProperty('id');
    expect(data.notification).toHaveProperty('userId');
    expect(data.notification).toHaveProperty('type');
    expect(data.notification).toHaveProperty('status');
    expect(data.notification).toHaveProperty('title');
    expect(data.notification).toHaveProperty('body');
    expect(data.notification).toHaveProperty('data');
    expect(data.notification).toHaveProperty('createdAt');
  });

  it('should return error message on failure', async () => {
    const requestBody = {
      matchId: 'match_123'
    };

    mockRequest.json.mockResolvedValue(requestBody);

    const response = await POST({ request: mockRequest } as any);
    const data = await response.json();

    expect(data).toHaveProperty('error');
    expect(typeof data.error).toBe('string');
  });

  // ============================================================================
  // NOTIFICATION DATA INTEGRITY
  // ============================================================================

  it('should preserve all input data in notification', async () => {
    const requestBody = {
      matchId: 'match_abc123',
      userId: 'user_xyz456',
      matchedUserId: 'user_def789',
      matchedUserName: 'Alexandra',
      matchedUserPhoto: 'https://example.com/alex.jpg'
    };

    mockRequest.json.mockResolvedValue(requestBody);

    const response = await POST({ request: mockRequest } as any);
    const data = await response.json();

    expect(data.notification.userId).toBe('user_xyz456');
    expect(data.notification.data.matchId).toBe('match_abc123');
    expect(data.notification.data.userId).toBe('user_def789');
    expect(data.notification.data.userName).toBe('Alexandra');
    expect(data.notification.data.userPhoto).toBe('https://example.com/alex.jpg');
  });

  it('should handle special characters in user names', async () => {
    const requestBody = {
      matchId: 'match_123',
      userId: 'user_456',
      matchedUserId: 'user_789',
      matchedUserName: "O'Brien-Smith"
    };

    mockRequest.json.mockResolvedValue(requestBody);

    const response = await POST({ request: mockRequest } as any);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.notification.data.userName).toBe("O'Brien-Smith");
  });

  it('should handle long user names', async () => {
    const longName = 'A'.repeat(100);
    const requestBody = {
      matchId: 'match_123',
      userId: 'user_456',
      matchedUserId: 'user_789',
      matchedUserName: longName
    };

    mockRequest.json.mockResolvedValue(requestBody);

    const response = await POST({ request: mockRequest } as any);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.notification.data.userName).toBe(longName);
  });

  it('should handle empty string user names', async () => {
    const requestBody = {
      matchId: 'match_123',
      userId: 'user_456',
      matchedUserId: 'user_789',
      matchedUserName: ''
    };

    mockRequest.json.mockResolvedValue(requestBody);

    const response = await POST({ request: mockRequest } as any);
    const data = await response.json();

    // Empty strings should be rejected
    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  // ============================================================================
  // PUSH NOTIFICATION SUPPORT
  // ============================================================================

  it('should support optional photo URL', async () => {
    const requestBody = {
      matchId: 'match_123',
      userId: 'user_456',
      matchedUserId: 'user_789',
      matchedUserName: 'Sarah'
      // No photo URL provided
    };

    mockRequest.json.mockResolvedValue(requestBody);

    const response = await POST({ request: mockRequest } as any);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.notification.data.userPhoto).toBeUndefined();
  });

  it('should handle various photo URL formats', async () => {
    const photoUrls = [
      'https://example.com/photo.jpg',
      'https://cdn.example.com/images/photo.png',
      'data:image/jpeg;base64,/9j/4AAQSkZJRg...'
    ];

    for (const photoUrl of photoUrls) {
      const requestBody = {
        matchId: 'match_123',
        userId: 'user_456',
        matchedUserId: 'user_789',
        matchedUserName: 'Sarah',
        matchedUserPhoto: photoUrl
      };

      mockRequest.json.mockResolvedValue(requestBody);

      const response = await POST({ request: mockRequest } as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.notification.data.userPhoto).toBe(photoUrl);
    }
  });
});
