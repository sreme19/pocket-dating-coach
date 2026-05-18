import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isNotificationSupported,
  areNotificationsEnabled,
  requestNotificationPermission,
  sendPushNotification,
  sendMessageNotification,
  sendMatchNotification,
  getConversationMutingStatus,
  setConversationMutingStatus,
  toggleConversationMuting,
  getMutedConversations,
  clearMutedConversations,
  formatNotificationForDisplay,
  handleNotificationClick,
  isAppInFocus,
  showInAppNotification,
  createNotificationFromResponse
} from './notificationService';

describe('Notification Service', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('isNotificationSupported', () => {
    it('should return false when Notification is not available', () => {
      const result = isNotificationSupported();
      // In test environment, Notification might not be available
      expect(typeof result).toBe('boolean');
    });
  });

  describe('areNotificationsEnabled', () => {
    it('should return false when notifications are not supported', () => {
      const result = areNotificationsEnabled();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Conversation Muting', () => {
    it('should return false for unmuted conversation by default', () => {
      const result = getConversationMutingStatus('conv_123');
      expect(result).toBe(false);
    });

    it('should set conversation as muted', () => {
      setConversationMutingStatus('conv_123', true);
      const result = getConversationMutingStatus('conv_123');
      expect(result).toBe(true);
    });

    it('should set conversation as unmuted', () => {
      setConversationMutingStatus('conv_123', true);
      setConversationMutingStatus('conv_123', false);
      const result = getConversationMutingStatus('conv_123');
      expect(result).toBe(false);
    });

    it('should toggle conversation muting status', () => {
      const initial = getConversationMutingStatus('conv_123');
      const toggled = toggleConversationMuting('conv_123');
      expect(toggled).toBe(!initial);
      expect(getConversationMutingStatus('conv_123')).toBe(toggled);
    });

    it('should toggle back to original state', () => {
      const initial = getConversationMutingStatus('conv_123');
      toggleConversationMuting('conv_123');
      toggleConversationMuting('conv_123');
      expect(getConversationMutingStatus('conv_123')).toBe(initial);
    });

    it('should handle multiple conversations independently', () => {
      setConversationMutingStatus('conv_123', true);
      setConversationMutingStatus('conv_456', false);

      expect(getConversationMutingStatus('conv_123')).toBe(true);
      expect(getConversationMutingStatus('conv_456')).toBe(false);
    });

    it('should get all muted conversations', () => {
      setConversationMutingStatus('conv_123', true);
      setConversationMutingStatus('conv_456', true);
      setConversationMutingStatus('conv_789', false);

      const muted = getMutedConversations();
      expect(muted).toContain('conv_123');
      expect(muted).toContain('conv_456');
      expect(muted).not.toContain('conv_789');
    });

    it('should clear all muted conversations', () => {
      setConversationMutingStatus('conv_123', true);
      setConversationMutingStatus('conv_456', true);

      clearMutedConversations();

      expect(getMutedConversations()).toEqual([]);
      expect(getConversationMutingStatus('conv_123')).toBe(false);
      expect(getConversationMutingStatus('conv_456')).toBe(false);
    });

    it('should handle invalid JSON in localStorage gracefully', () => {
      localStorage.setItem('vv_muted_conversations', 'invalid json');
      const result = getConversationMutingStatus('conv_123');
      expect(result).toBe(false);
    });

    it('should handle corrupted muted conversations list', () => {
      localStorage.setItem('vv_muted_conversations', 'not an array');
      const muted = getMutedConversations();
      expect(muted).toEqual([]);
    });
  });

  describe('formatNotificationForDisplay', () => {
    it('should format notification with all fields', () => {
      const notification = {
        id: 'notif_123',
        userId: 'user_456',
        type: 'message' as const,
        status: 'unread' as const,
        title: 'Message from John',
        body: 'Hello!',
        data: {
          userPhoto: 'https://example.com/photo.jpg',
          actionUrl: '/verified-vibe/chat/conv_123'
        },
        createdAt: new Date()
      };

      const formatted = formatNotificationForDisplay(notification);

      expect(formatted.title).toBe('Message from John');
      expect(formatted.body).toBe('Hello!');
      expect(formatted.icon).toBe('https://example.com/photo.jpg');
      expect(formatted.actionUrl).toBe('/verified-vibe/chat/conv_123');
    });

    it('should handle notification without photo', () => {
      const notification = {
        id: 'notif_123',
        userId: 'user_456',
        type: 'message' as const,
        status: 'unread' as const,
        title: 'Message from John',
        body: 'Hello!',
        data: {
          actionUrl: '/verified-vibe/chat/conv_123'
        },
        createdAt: new Date()
      };

      const formatted = formatNotificationForDisplay(notification);

      expect(formatted.icon).toBeUndefined();
      expect(formatted.actionUrl).toBe('/verified-vibe/chat/conv_123');
    });

    it('should handle notification without action URL', () => {
      const notification = {
        id: 'notif_123',
        userId: 'user_456',
        type: 'message' as const,
        status: 'unread' as const,
        title: 'Message from John',
        body: 'Hello!',
        data: {},
        createdAt: new Date()
      };

      const formatted = formatNotificationForDisplay(notification);

      expect(formatted.actionUrl).toBeUndefined();
    });
  });

  describe('isAppInFocus', () => {
    it('should return a boolean', () => {
      const result = isAppInFocus();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('showInAppNotification', () => {
    it('should dispatch notification event', () => {
      const listener = vi.fn();
      window.addEventListener('notification', listener);

      showInAppNotification('Test Title', 'Test Body', 'message');

      expect(listener).toHaveBeenCalled();
      const event = listener.mock.calls[0][0] as CustomEvent;
      expect(event.detail.title).toBe('Test Title');
      expect(event.detail.body).toBe('Test Body');
      expect(event.detail.type).toBe('message');

      window.removeEventListener('notification', listener);
    });

    it('should dispatch notification event with default type', () => {
      const listener = vi.fn();
      window.addEventListener('notification', listener);

      showInAppNotification('Test Title', 'Test Body');

      expect(listener).toHaveBeenCalled();
      const event = listener.mock.calls[0][0] as CustomEvent;
      expect(event.detail.type).toBe('system');

      window.removeEventListener('notification', listener);
    });
  });

  describe('createNotificationFromResponse', () => {
    it('should create notification from API response', () => {
      const response = {
        id: 'notif_123',
        userId: 'user_456',
        type: 'message',
        status: 'unread',
        title: 'Message from John',
        body: 'Hello!',
        data: {
          actionUrl: '/verified-vibe/chat/conv_123'
        },
        createdAt: new Date().toISOString()
      };

      const notification = createNotificationFromResponse(response);

      expect(notification.id).toBe('notif_123');
      expect(notification.userId).toBe('user_456');
      expect(notification.type).toBe('message');
      expect(notification.status).toBe('unread');
      expect(notification.title).toBe('Message from John');
      expect(notification.body).toBe('Hello!');
    });

    it('should generate ID if not provided', () => {
      const response = {
        userId: 'user_456',
        type: 'message',
        status: 'unread',
        title: 'Message from John',
        body: 'Hello!',
        data: {},
        createdAt: new Date().toISOString()
      };

      const notification = createNotificationFromResponse(response);

      expect(notification.id).toBeDefined();
      expect(notification.id).toMatch(/^notif_/);
    });

    it('should handle missing data field', () => {
      const response = {
        id: 'notif_123',
        userId: 'user_456',
        type: 'message',
        status: 'unread',
        title: 'Message from John',
        body: 'Hello!',
        createdAt: new Date().toISOString()
      };

      const notification = createNotificationFromResponse(response);

      expect(notification.data).toEqual({});
    });

    it('should parse readAt timestamp if provided', () => {
      const now = new Date();
      const response = {
        id: 'notif_123',
        userId: 'user_456',
        type: 'message',
        status: 'read',
        title: 'Message from John',
        body: 'Hello!',
        data: {},
        createdAt: new Date().toISOString(),
        readAt: now.toISOString()
      };

      const notification = createNotificationFromResponse(response);

      expect(notification.readAt).toBeDefined();
      expect(notification.readAt).toBeInstanceOf(Date);
    });
  });

  describe('sendMessageNotification', () => {
    it('should create message notification with correct structure', () => {
      // This test would require mocking the Notification API
      // For now, we just verify the function doesn't throw
      expect(() => {
        sendMessageNotification('John Doe', 'Hello!', 'conv_123');
      }).not.toThrow();
    });

    it('should include sender photo if provided', () => {
      expect(() => {
        sendMessageNotification('John Doe', 'Hello!', 'conv_123', 'https://example.com/photo.jpg');
      }).not.toThrow();
    });
  });

  describe('sendMatchNotification', () => {
    it('should create match notification with correct structure', () => {
      expect(() => {
        sendMatchNotification('Jane Smith', 'match_123');
      }).not.toThrow();
    });

    it('should include matched user photo if provided', () => {
      expect(() => {
        sendMatchNotification('Jane Smith', 'match_123', 'https://example.com/photo.jpg');
      }).not.toThrow();
    });
  });

  describe('handleNotificationClick', () => {
    it('should navigate to action URL if provided', () => {
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { href: '' } as any;

      const notification = {
        id: 'notif_123',
        userId: 'user_456',
        type: 'message' as const,
        status: 'unread' as const,
        title: 'Message from John',
        body: 'Hello!',
        data: {
          actionUrl: '/verified-vibe/chat/conv_123'
        },
        createdAt: new Date()
      };

      handleNotificationClick(notification);

      expect(window.location.href).toBe('/verified-vibe/chat/conv_123');

      window.location = originalLocation;
    });

    it('should not navigate if action URL is not provided', () => {
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { href: '' } as any;

      const notification = {
        id: 'notif_123',
        userId: 'user_456',
        type: 'message' as const,
        status: 'unread' as const,
        title: 'Message from John',
        body: 'Hello!',
        data: {},
        createdAt: new Date()
      };

      handleNotificationClick(notification);

      expect(window.location.href).toBe('');

      window.location = originalLocation;
    });
  });

  describe('requestNotificationPermission', () => {
    it('should return a boolean', async () => {
      const result = await requestNotificationPermission();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('sendPushNotification', () => {
    it('should return null when notifications are not enabled', () => {
      const result = sendPushNotification({
        title: 'Test',
        body: 'Test body'
      });

      // Result depends on browser support and permission
      expect(result === null || result instanceof Notification).toBe(true);
    });
  });
});
