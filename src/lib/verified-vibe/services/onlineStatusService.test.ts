import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  formatLastSeen,
  isRecentlyActive,
  type OnlineStatus
} from './onlineStatusService';

describe('onlineStatusService', () => {
  describe('formatLastSeen', () => {
    it('should return "Never" for null lastSeen', () => {
      expect(formatLastSeen(null)).toBe('Never');
    });

    it('should return "Just now" for times less than 60 seconds ago', () => {
      const now = new Date();
      const secondsAgo30 = new Date(now.getTime() - 30000);
      expect(formatLastSeen(secondsAgo30)).toBe('Just now');
    });

    it('should return minutes ago for times less than 60 minutes ago', () => {
      const now = new Date();
      const minutesAgo5 = new Date(now.getTime() - 5 * 60000);
      expect(formatLastSeen(minutesAgo5)).toBe('5m ago');
    });

    it('should return hours ago for times less than 24 hours ago', () => {
      const now = new Date();
      const hoursAgo3 = new Date(now.getTime() - 3 * 3600000);
      expect(formatLastSeen(hoursAgo3)).toBe('3h ago');
    });

    it('should return days ago for times less than 7 days ago', () => {
      const now = new Date();
      const daysAgo2 = new Date(now.getTime() - 2 * 86400000);
      expect(formatLastSeen(daysAgo2)).toBe('2d ago');
    });

    it('should return formatted date for times older than 7 days', () => {
      const now = new Date();
      const daysAgo10 = new Date(now.getTime() - 10 * 86400000);
      const formatted = formatLastSeen(daysAgo10);
      // Should be in format like "Jan 1" or similar
      expect(formatted).toMatch(/\w+ \d+/);
    });
  });

  describe('isRecentlyActive', () => {
    it('should return true if user is online', () => {
      const status: OnlineStatus = {
        userId: 'user-1',
        isOnline: true,
        lastSeen: null
      };
      expect(isRecentlyActive(status)).toBe(true);
    });

    it('should return false if user is offline and lastSeen is null', () => {
      const status: OnlineStatus = {
        userId: 'user-1',
        isOnline: false,
        lastSeen: null
      };
      expect(isRecentlyActive(status)).toBe(false);
    });

    it('should return true if user was seen within last 5 minutes', () => {
      const now = new Date();
      const minutesAgo3 = new Date(now.getTime() - 3 * 60000);
      const status: OnlineStatus = {
        userId: 'user-1',
        isOnline: false,
        lastSeen: minutesAgo3
      };
      expect(isRecentlyActive(status)).toBe(true);
    });

    it('should return false if user was seen more than 5 minutes ago', () => {
      const now = new Date();
      const minutesAgo10 = new Date(now.getTime() - 10 * 60000);
      const status: OnlineStatus = {
        userId: 'user-1',
        isOnline: false,
        lastSeen: minutesAgo10
      };
      expect(isRecentlyActive(status)).toBe(false);
    });
  });
});
