import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createMatchNotification,
  createMessageNotification,
  createVerificationNotification,
  createSystemNotification,
  notificationToPushConfig,
  sendPushNotification,
  sendNotification,
  batchSendNotifications,
  formatNotification,
  getNotificationIcon,
  getNotificationColorClass,
  isRecentNotification,
  sortNotificationsByDate,
  filterNotificationsByType,
  getUnreadNotifications,
  countUnreadNotifications
} from './notifications';
import type { Notification } from '../types';

/**
 * Tests for Notifications Server Module
 *
 * Tests notification creation, formatting, and management functions
 */

describe('Notifications Server Module', () => {
  // ============================================================================
  // CREATE MATCH NOTIFICATION
  // ============================================================================

  describe('createMatchNotification', () => {
    it('should create a match notification with all required fields', () => {
      const notification = createMatchNotification(
        'user_123',
        'user_456',
        'Sarah',
        'https://example.com/sarah.jpg',
        'match_789'
      );

      expect(notification.id).toBeDefined();
      expect(notification.userId).toBe('user_123');
      expect(notification.type).toBe('match');
      expect(notification.status).toBe('unread');
      expect(notification.title).toBe('New Match!');
      expect(notification.body).toContain('Sarah');
      expect(notification.data.matchId).toBe('match_789');
      expect(notification.data.userId).toBe('user_456');
      expect(notification.data.userName).toBe('Sarah');
      expect(notification.data.userPhoto).toBe('https://example.com/sarah.jpg');
      expect(notification.data.actionUrl).toBe('/verified-vibe/chat/match_789');
    });

    it('should handle missing photo URL', () => {
      const notification = createMatchNotification(
        'user_123',
        'user_456',
        'Sarah',
        undefined,
        'match_789'
      );

      expect(notification.data.userPhoto).toBeUndefined();
    });

    it('should generate unique notification IDs', () => {
      const notif1 = createMatchNotification('user_123', 'user_456', 'Sarah', undefined, 'match_789');
      const notif2 = createMatchNotification('user_123', 'user_456', 'Sarah', undefined, 'match_789');

      expect(notif1.id).not.toBe(notif2.id);
    });
  });

  // ============================================================================
  // CREATE MESSAGE NOTIFICATION
  // ============================================================================

  describe('createMessageNotification', () => {
    it('should create a message notification', () => {
      const notification = createMessageNotification(
        'user_123',
        'Sarah',
        'Hey, how are you?',
        'match_789'
      );

      expect(notification.type).toBe('message');
      expect(notification.title).toBe('New Message');
      expect(notification.body).toContain('Sarah');
      expect(notification.body).toContain('Hey, how are you?');
      expect(notification.data.matchId).toBe('match_789');
      expect(notification.data.actionUrl).toBe('/verified-vibe/chat/match_789');
    });

    it('should handle long message previews', () => {
      const longMessage = 'A'.repeat(200);
      const notification = createMessageNotification(
        'user_123',
        'Sarah',
        longMessage,
        'match_789'
      );

      expect(notification.body).toContain(longMessage);
    });
  });

  // ============================================================================
  // CREATE VERIFICATION NOTIFICATION
  // ============================================================================

  describe('createVerificationNotification', () => {
    it('should create a verification notification for ID step', () => {
      const notification = createVerificationNotification('user_123', 'id');

      expect(notification.type).toBe('verification');
      expect(notification.title).toBe('Verification Complete');
      expect(notification.body).toContain('ID Verification');
    });

    it('should create a verification notification for liveness step', () => {
      const notification = createVerificationNotification('user_123', 'liveness');

      expect(notification.body).toContain('Liveness Check');
    });

    it('should create a verification notification for photos step', () => {
      const notification = createVerificationNotification('user_123', 'photos');

      expect(notification.body).toContain('Photo Verification');
    });

    it('should create a verification notification for Q&A step', () => {
      const notification = createVerificationNotification('user_123', 'spending_or_qa');

      expect(notification.body).toContain('Q&A Completion');
    });

    it('should handle unknown verification steps', () => {
      const notification = createVerificationNotification('user_123', 'unknown_step');

      expect(notification.body).toContain('unknown_step');
    });
  });

  // ============================================================================
  // CREATE SYSTEM NOTIFICATION
  // ============================================================================

  describe('createSystemNotification', () => {
    it('should create a system notification', () => {
      const notification = createSystemNotification(
        'user_123',
        'Welcome!',
        'Welcome to Verified Vibe',
        '/verified-vibe/home'
      );

      expect(notification.type).toBe('system');
      expect(notification.title).toBe('Welcome!');
      expect(notification.body).toBe('Welcome to Verified Vibe');
      expect(notification.data.actionUrl).toBe('/verified-vibe/home');
    });

    it('should handle system notification without action URL', () => {
      const notification = createSystemNotification(
        'user_123',
        'Maintenance',
        'System maintenance scheduled'
      );

      expect(notification.data.actionUrl).toBeUndefined();
    });
  });

  // ============================================================================
  // NOTIFICATION TO PUSH CONFIG
  // ============================================================================

  describe('notificationToPushConfig', () => {
    it('should convert match notification to push config', () => {
      const notification = createMatchNotification(
        'user_123',
        'user_456',
        'Sarah',
        'https://example.com/sarah.jpg',
        'match_789'
      );

      const config = notificationToPushConfig(notification);

      expect(config.title).toBe('New Match!');
      expect(config.body).toContain('Sarah');
      expect(config.icon).toBe('💕');
      expect(config.tag).toBe('match');
      expect(config.data).toBeDefined();
    });

    it('should convert message notification to push config', () => {
      const notification = createMessageNotification(
        'user_123',
        'Sarah',
        'Hey!',
        'match_789'
      );

      const config = notificationToPushConfig(notification);

      expect(config.icon).toBe('💬');
      expect(config.tag).toBe('message');
    });

    it('should convert verification notification to push config', () => {
      const notification = createVerificationNotification('user_123', 'id');

      const config = notificationToPushConfig(notification);

      expect(config.icon).toBe('✓');
      expect(config.tag).toBe('verification');
    });

    it('should convert system notification to push config', () => {
      const notification = createSystemNotification('user_123', 'Alert', 'Alert message');

      const config = notificationToPushConfig(notification);

      expect(config.icon).toBe('ℹ️');
      expect(config.tag).toBe('system');
    });
  });

  // ============================================================================
  // SEND PUSH NOTIFICATION
  // ============================================================================

  describe('sendPushNotification', () => {
    it('should send push notification without error', async () => {
      const config = {
        title: 'Test',
        body: 'Test notification'
      };

      await expect(sendPushNotification('user_123', config)).resolves.toBeUndefined();
    });

    it('should handle push notification with data', async () => {
      const config = {
        title: 'Test',
        body: 'Test notification',
        data: { matchId: 'match_123' }
      };

      await expect(sendPushNotification('user_123', config)).resolves.toBeUndefined();
    });
  });

  // ============================================================================
  // SEND NOTIFICATION
  // ============================================================================

  describe('sendNotification', () => {
    it('should send notification without error', async () => {
      const notification = createMatchNotification(
        'user_123',
        'user_456',
        'Sarah',
        undefined,
        'match_789'
      );

      await expect(sendNotification(notification)).resolves.toBeUndefined();
    });

    it('should send notification without push', async () => {
      const notification = createMatchNotification(
        'user_123',
        'user_456',
        'Sarah',
        undefined,
        'match_789'
      );

      await expect(sendNotification(notification, false)).resolves.toBeUndefined();
    });
  });

  // ============================================================================
  // BATCH SEND NOTIFICATIONS
  // ============================================================================

  describe('batchSendNotifications', () => {
    it('should send multiple notifications', async () => {
      const notifications = [
        createMatchNotification('user_123', 'user_456', 'Sarah', undefined, 'match_789'),
        createMessageNotification('user_123', 'Sarah', 'Hey!', 'match_789')
      ];

      await expect(batchSendNotifications(notifications)).resolves.toBeUndefined();
    });

    it('should handle empty notification array', async () => {
      await expect(batchSendNotifications([])).resolves.toBeUndefined();
    });
  });

  // ============================================================================
  // FORMAT NOTIFICATION
  // ============================================================================

  describe('formatNotification', () => {
    it('should format notification as string', () => {
      const notification = createMatchNotification(
        'user_123',
        'user_456',
        'Sarah',
        undefined,
        'match_789'
      );

      const formatted = formatNotification(notification);

      expect(formatted).toContain('New Match!');
      expect(formatted).toContain('Sarah');
    });
  });

  // ============================================================================
  // GET NOTIFICATION ICON
  // ============================================================================

  describe('getNotificationIcon', () => {
    it('should return match icon', () => {
      expect(getNotificationIcon('match')).toBe('💕');
    });

    it('should return message icon', () => {
      expect(getNotificationIcon('message')).toBe('💬');
    });

    it('should return verification icon', () => {
      expect(getNotificationIcon('verification')).toBe('✓');
    });

    it('should return system icon', () => {
      expect(getNotificationIcon('system')).toBe('ℹ️');
    });

    it('should return default icon for unknown type', () => {
      expect(getNotificationIcon('unknown')).toBe('🔔');
    });
  });

  // ============================================================================
  // GET NOTIFICATION COLOR CLASS
  // ============================================================================

  describe('getNotificationColorClass', () => {
    it('should return match color class', () => {
      expect(getNotificationColorClass('match')).toBe('notification-match');
    });

    it('should return message color class', () => {
      expect(getNotificationColorClass('message')).toBe('notification-message');
    });

    it('should return verification color class', () => {
      expect(getNotificationColorClass('verification')).toBe('notification-verification');
    });

    it('should return system color class', () => {
      expect(getNotificationColorClass('system')).toBe('notification-system');
    });

    it('should return default color class for unknown type', () => {
      expect(getNotificationColorClass('unknown')).toBe('notification-default');
    });
  });

  // ============================================================================
  // IS RECENT NOTIFICATION
  // ============================================================================

  describe('isRecentNotification', () => {
    it('should return true for recent notification', () => {
      const notification = createMatchNotification(
        'user_123',
        'user_456',
        'Sarah',
        undefined,
        'match_789'
      );

      expect(isRecentNotification(notification)).toBe(true);
    });

    it('should return false for old notification', () => {
      const notification = createMatchNotification(
        'user_123',
        'user_456',
        'Sarah',
        undefined,
        'match_789'
      );
      notification.createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

      expect(isRecentNotification(notification)).toBe(false);
    });
  });

  // ============================================================================
  // SORT NOTIFICATIONS BY DATE
  // ============================================================================

  describe('sortNotificationsByDate', () => {
    it('should sort notifications by date (newest first)', () => {
      const notif1 = createMatchNotification('user_123', 'user_456', 'Sarah', undefined, 'match_789');
      const notif2 = createMessageNotification('user_123', 'Sarah', 'Hey!', 'match_789');

      notif1.createdAt = new Date('2024-01-01');
      notif2.createdAt = new Date('2024-01-02');

      const sorted = sortNotificationsByDate([notif1, notif2]);

      expect(sorted[0].createdAt).toEqual(new Date('2024-01-02'));
      expect(sorted[1].createdAt).toEqual(new Date('2024-01-01'));
    });
  });

  // ============================================================================
  // FILTER NOTIFICATIONS BY TYPE
  // ============================================================================

  describe('filterNotificationsByType', () => {
    it('should filter notifications by type', () => {
      const notifications = [
        createMatchNotification('user_123', 'user_456', 'Sarah', undefined, 'match_789'),
        createMessageNotification('user_123', 'Sarah', 'Hey!', 'match_789'),
        createMatchNotification('user_123', 'user_789', 'Emma', undefined, 'match_456')
      ];

      const filtered = filterNotificationsByType(notifications, 'match');

      expect(filtered.length).toBe(2);
      expect(filtered.every((n) => n.type === 'match')).toBe(true);
    });

    it('should return empty array if no notifications match type', () => {
      const notifications = [
        createMatchNotification('user_123', 'user_456', 'Sarah', undefined, 'match_789')
      ];

      const filtered = filterNotificationsByType(notifications, 'message');

      expect(filtered.length).toBe(0);
    });
  });

  // ============================================================================
  // GET UNREAD NOTIFICATIONS
  // ============================================================================

  describe('getUnreadNotifications', () => {
    it('should return only unread notifications', () => {
      const notif1 = createMatchNotification('user_123', 'user_456', 'Sarah', undefined, 'match_789');
      const notif2 = createMessageNotification('user_123', 'Sarah', 'Hey!', 'match_789');

      notif2.status = 'read';

      const unread = getUnreadNotifications([notif1, notif2]);

      expect(unread.length).toBe(1);
      expect(unread[0].id).toBe(notif1.id);
    });

    it('should return empty array if all notifications are read', () => {
      const notif1 = createMatchNotification('user_123', 'user_456', 'Sarah', undefined, 'match_789');
      notif1.status = 'read';

      const unread = getUnreadNotifications([notif1]);

      expect(unread.length).toBe(0);
    });
  });

  // ============================================================================
  // COUNT UNREAD NOTIFICATIONS
  // ============================================================================

  describe('countUnreadNotifications', () => {
    it('should count unread notifications', () => {
      const notif1 = createMatchNotification('user_123', 'user_456', 'Sarah', undefined, 'match_789');
      const notif2 = createMessageNotification('user_123', 'Sarah', 'Hey!', 'match_789');
      const notif3 = createVerificationNotification('user_123', 'id');

      notif2.status = 'read';

      const count = countUnreadNotifications([notif1, notif2, notif3]);

      expect(count).toBe(2);
    });

    it('should return 0 if all notifications are read', () => {
      const notif1 = createMatchNotification('user_123', 'user_456', 'Sarah', undefined, 'match_789');
      notif1.status = 'read';

      const count = countUnreadNotifications([notif1]);

      expect(count).toBe(0);
    });
  });
});
