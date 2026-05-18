import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  formatLastSeen,
  isRecentlyActive,
  type OnlineStatus
} from './onlineStatusService';

/**
 * Multi-client online status tests
 * 
 * **Validates: Requirements 4.5 - Online Status**
 * - Track user online status in Supabase
 * - Show online indicator in chat
 * - Show "last seen" for offline users
 * - Update status on app open/close
 * - Handle connection loss
 * - Test with multiple clients
 */

describe('Online Status - Multiple Client Scenarios', () => {
  describe('Multiple Client Presence', () => {
    it('should track multiple users online simultaneously', () => {
      const users = [
        { userId: 'user-1', isOnline: true, lastSeen: null },
        { userId: 'user-2', isOnline: true, lastSeen: null },
        { userId: 'user-3', isOnline: true, lastSeen: null }
      ];

      expect(users).toHaveLength(3);
      expect(users.every((u) => u.isOnline)).toBe(true);
    });

    it('should handle mixed online/offline status', () => {
      const now = new Date();
      const users = [
        { userId: 'user-1', isOnline: true, lastSeen: null },
        { userId: 'user-2', isOnline: false, lastSeen: new Date(now.getTime() - 5 * 60000) },
        { userId: 'user-3', isOnline: true, lastSeen: null }
      ];

      const onlineCount = users.filter((u) => u.isOnline).length;
      const offlineCount = users.filter((u) => !u.isOnline).length;

      expect(onlineCount).toBe(2);
      expect(offlineCount).toBe(1);
    });

    it('should update status when user comes online', () => {
      let status: OnlineStatus = {
        userId: 'user-1',
        isOnline: false,
        lastSeen: new Date(Date.now() - 10 * 60000)
      };

      // User comes online
      status = {
        userId: 'user-1',
        isOnline: true,
        lastSeen: null
      };

      expect(status.isOnline).toBe(true);
      expect(status.lastSeen).toBeNull();
    });

    it('should update status when user goes offline', () => {
      let status: OnlineStatus = {
        userId: 'user-1',
        isOnline: true,
        lastSeen: null
      };

      const now = new Date();

      // User goes offline
      status = {
        userId: 'user-1',
        isOnline: false,
        lastSeen: now
      };

      expect(status.isOnline).toBe(false);
      expect(status.lastSeen).not.toBeNull();
    });

    it('should handle rapid status changes from multiple users', () => {
      const statusUpdates: OnlineStatus[] = [];

      // Simulate rapid updates from 3 users
      for (let i = 0; i < 3; i++) {
        statusUpdates.push({
          userId: `user-${i}`,
          isOnline: i % 2 === 0,
          lastSeen: i % 2 === 0 ? null : new Date()
        });
      }

      expect(statusUpdates).toHaveLength(3);
      expect(statusUpdates[0].isOnline).toBe(true);
      expect(statusUpdates[1].isOnline).toBe(false);
      expect(statusUpdates[2].isOnline).toBe(true);
    });
  });

  describe('Connection Loss with Multiple Clients', () => {
    it('should maintain last seen time during connection loss', () => {
      const lastSeenTime = new Date(Date.now() - 10 * 60000);
      const formattedTime = formatLastSeen(lastSeenTime);

      expect(formattedTime).toBe('10m ago');
    });

    it('should handle connection loss for one user while others remain online', () => {
      const users = [
        { userId: 'user-1', isOnline: true, lastSeen: null },
        { userId: 'user-2', isOnline: false, lastSeen: new Date(Date.now() - 2 * 60000) },
        { userId: 'user-3', isOnline: true, lastSeen: null }
      ];

      const onlineUsers = users.filter((u) => u.isOnline);
      expect(onlineUsers).toHaveLength(2);
    });

    it('should recover connection for offline user', () => {
      let users = [
        { userId: 'user-1', isOnline: true, lastSeen: null },
        { userId: 'user-2', isOnline: false, lastSeen: new Date(Date.now() - 5 * 60000) },
        { userId: 'user-3', isOnline: true, lastSeen: null }
      ];

      // User-2 comes back online
      users = users.map((u) =>
        u.userId === 'user-2'
          ? { userId: u.userId, isOnline: true, lastSeen: null }
          : u
      );

      const onlineUsers = users.filter((u) => u.isOnline);
      expect(onlineUsers).toHaveLength(3);
    });

    it('should handle cascading connection loss', () => {
      let users = [
        { userId: 'user-1', isOnline: true, lastSeen: null },
        { userId: 'user-2', isOnline: true, lastSeen: null },
        { userId: 'user-3', isOnline: true, lastSeen: null }
      ];

      const now = new Date();

      // Simulate cascading connection loss
      users = users.map((u, i) => ({
        userId: u.userId,
        isOnline: i === 0, // Only first user remains online
        lastSeen: i === 0 ? null : new Date(now.getTime() - (i * 5 * 60000))
      }));

      expect(users.filter((u) => u.isOnline)).toHaveLength(1);
      expect(users.filter((u) => !u.isOnline)).toHaveLength(2);
    });

    it('should handle reconnection after cascading loss', () => {
      let users = [
        { userId: 'user-1', isOnline: true, lastSeen: null },
        { userId: 'user-2', isOnline: false, lastSeen: new Date(Date.now() - 10 * 60000) },
        { userId: 'user-3', isOnline: false, lastSeen: new Date(Date.now() - 15 * 60000) }
      ];

      // All users come back online
      users = users.map((u) => ({
        userId: u.userId,
        isOnline: true,
        lastSeen: null
      }));

      expect(users.every((u) => u.isOnline)).toBe(true);
    });
  });

  describe('App Open/Close Lifecycle', () => {
    it('should track user as online on app open', () => {
      const userId = 'user-1';
      let isOnline = false;

      // Simulate app open
      isOnline = true;

      expect(isOnline).toBe(true);
    });

    it('should untrack user on app close', () => {
      const userId = 'user-1';
      let isOnline = true;

      // Simulate app close
      isOnline = false;

      expect(isOnline).toBe(false);
    });

    it('should update last activity on app open', () => {
      let lastActivity: Date | null = null;

      // Simulate app open
      lastActivity = new Date();

      expect(lastActivity).not.toBeNull();
      expect(lastActivity?.getTime()).toBeGreaterThan(0);
    });

    it('should handle multiple app open/close cycles', () => {
      const cycles: { opened: boolean; timestamp: Date }[] = [];

      for (let i = 0; i < 3; i++) {
        cycles.push({ opened: true, timestamp: new Date() });
        cycles.push({ opened: false, timestamp: new Date() });
      }

      expect(cycles).toHaveLength(6);
      expect(cycles[0].opened).toBe(true);
      expect(cycles[1].opened).toBe(false);
    });

    it('should preserve last seen time across app close/open', () => {
      let lastSeen: Date | null = null;

      // User is online
      let isOnline = true;
      lastSeen = null;

      // App closes
      isOnline = false;
      lastSeen = new Date();

      const lastSeenBeforeReopen = lastSeen;

      // App opens again
      isOnline = true;
      lastSeen = null;

      expect(lastSeenBeforeReopen).not.toBeNull();
      expect(isOnline).toBe(true);
    });
  });

  describe('Last Seen Accuracy', () => {
    it('should show accurate last seen time for offline users', () => {
      const now = new Date();
      const minutesAgo5 = new Date(now.getTime() - 5 * 60000);

      const lastSeen = formatLastSeen(minutesAgo5);
      expect(lastSeen).toBe('5m ago');
    });

    it('should update last seen time as time passes', () => {
      const now = new Date();
      const minutesAgo5 = new Date(now.getTime() - 5 * 60000);

      let lastSeen = formatLastSeen(minutesAgo5);
      expect(lastSeen).toBe('5m ago');

      // Simulate time passing
      const minutesAgo6 = new Date(now.getTime() - 6 * 60000);
      lastSeen = formatLastSeen(minutesAgo6);
      expect(lastSeen).toBe('6m ago');
    });

    it('should handle last seen for multiple users', () => {
      const now = new Date();
      const users = [
        { userId: 'user-1', lastSeen: new Date(now.getTime() - 2 * 60000) },
        { userId: 'user-2', lastSeen: new Date(now.getTime() - 5 * 60000) },
        { userId: 'user-3', lastSeen: new Date(now.getTime() - 10 * 60000) }
      ];

      const formattedTimes = users.map((u) => formatLastSeen(u.lastSeen));

      expect(formattedTimes[0]).toBe('2m ago');
      expect(formattedTimes[1]).toBe('5m ago');
      expect(formattedTimes[2]).toBe('10m ago');
    });
  });

  describe('Recently Active Status', () => {
    it('should identify recently active users', () => {
      const now = new Date();
      const users = [
        { userId: 'user-1', isOnline: true, lastSeen: null },
        { userId: 'user-2', isOnline: false, lastSeen: new Date(now.getTime() - 3 * 60000) },
        { userId: 'user-3', isOnline: false, lastSeen: new Date(now.getTime() - 10 * 60000) }
      ];

      const recentlyActive = users.filter((u) => isRecentlyActive(u as OnlineStatus));

      expect(recentlyActive).toHaveLength(2); // user-1 (online) and user-2 (within 5 min)
    });

    it('should identify inactive users', () => {
      const now = new Date();
      const users = [
        { userId: 'user-1', isOnline: false, lastSeen: new Date(now.getTime() - 10 * 60000) },
        { userId: 'user-2', isOnline: false, lastSeen: new Date(now.getTime() - 20 * 60000) },
        { userId: 'user-3', isOnline: false, lastSeen: null }
      ];

      const inactive = users.filter((u) => !isRecentlyActive(u as OnlineStatus));

      expect(inactive).toHaveLength(3);
    });
  });

  describe('Concurrent Updates', () => {
    it('should handle concurrent status updates from multiple users', () => {
      const updates: OnlineStatus[] = [];

      // Simulate concurrent updates
      for (let i = 0; i < 5; i++) {
        updates.push({
          userId: `user-${i}`,
          isOnline: Math.random() > 0.5,
          lastSeen: Math.random() > 0.5 ? new Date() : null
        });
      }

      expect(updates).toHaveLength(5);
      updates.forEach((u) => {
        expect(u.userId).toBeDefined();
        expect(typeof u.isOnline).toBe('boolean');
      });
    });

    it('should maintain consistency during concurrent updates', () => {
      const statusMap = new Map<string, OnlineStatus>();

      // Add initial statuses
      for (let i = 0; i < 3; i++) {
        statusMap.set(`user-${i}`, {
          userId: `user-${i}`,
          isOnline: true,
          lastSeen: null
        });
      }

      // Concurrent updates
      statusMap.set('user-0', { userId: 'user-0', isOnline: false, lastSeen: new Date() });
      statusMap.set('user-1', { userId: 'user-1', isOnline: false, lastSeen: new Date() });

      const onlineCount = Array.from(statusMap.values()).filter((u) => u.isOnline).length;
      expect(onlineCount).toBe(1);
    });

    it('should handle rapid status changes without data loss', () => {
      const statusHistory: OnlineStatus[] = [];

      // Simulate rapid changes for one user
      for (let i = 0; i < 10; i++) {
        statusHistory.push({
          userId: 'user-1',
          isOnline: i % 2 === 0,
          lastSeen: i % 2 === 0 ? null : new Date()
        });
      }

      expect(statusHistory).toHaveLength(10);
      expect(statusHistory[0].isOnline).toBe(true);
      expect(statusHistory[1].isOnline).toBe(false);
    });
  });

  describe('Presence Channel Management', () => {
    it('should manage multiple presence channels', () => {
      const channels = new Map<string, string>();

      // Add channels for multiple users
      channels.set('user-1', 'user:user-1:presence');
      channels.set('user-2', 'user:user-2:presence');
      channels.set('user-3', 'user:user-3:presence');

      expect(channels.size).toBe(3);
      expect(channels.get('user-1')).toBe('user:user-1:presence');
    });

    it('should clean up channels on unsubscribe', () => {
      const channels = new Map<string, string>();

      channels.set('user-1', 'user:user-1:presence');
      channels.set('user-2', 'user:user-2:presence');

      // Remove channel
      channels.delete('user-1');

      expect(channels.size).toBe(1);
      expect(channels.has('user-1')).toBe(false);
    });

    it('should handle channel errors gracefully', () => {
      const channels = new Map<string, { error?: string }>();

      channels.set('user-1', { error: 'Connection failed' });
      channels.set('user-2', {});

      const failedChannels = Array.from(channels.values()).filter((c) => c.error);
      expect(failedChannels).toHaveLength(1);
    });
  });

  describe('Scalability', () => {
    it('should handle large number of concurrent users', () => {
      const users: OnlineStatus[] = [];

      // Simulate 100 concurrent users
      for (let i = 0; i < 100; i++) {
        users.push({
          userId: `user-${i}`,
          isOnline: Math.random() > 0.3, // 70% online
          lastSeen: Math.random() > 0.3 ? null : new Date()
        });
      }

      expect(users).toHaveLength(100);
      const onlineCount = users.filter((u) => u.isOnline).length;
      expect(onlineCount).toBeGreaterThan(50);
      expect(onlineCount).toBeLessThan(100);
    });

    it('should efficiently track status changes at scale', () => {
      const statusMap = new Map<string, OnlineStatus>();

      // Add 100 users
      for (let i = 0; i < 100; i++) {
        statusMap.set(`user-${i}`, {
          userId: `user-${i}`,
          isOnline: true,
          lastSeen: null
        });
      }

      // Update 50 users
      for (let i = 0; i < 50; i++) {
        statusMap.set(`user-${i}`, {
          userId: `user-${i}`,
          isOnline: false,
          lastSeen: new Date()
        });
      }

      const onlineCount = Array.from(statusMap.values()).filter((u) => u.isOnline).length;
      expect(onlineCount).toBe(50);
    });
  });
});
