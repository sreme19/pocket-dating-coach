/**
 * Online Status Service
 *
 * Manages user online status tracking and publishing.
 * Tracks when users come online/offline and updates last seen timestamps.
 */

import { publishOnlineStatus } from './realtimeService';
import { updateCurrentUserOnlineStatus, updateUserOnlineStatus } from '../stores';

const ACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const HEARTBEAT_INTERVAL = 30 * 1000; // 30 seconds

interface UserOnlineStatus {
  userId: string;
  isOnline: boolean;
  lastSeen: Date;
  lastActivity: Date;
}

export interface OnlineStatus {
  userId: string;
  isOnline: boolean;
  lastSeen: Date | null;
}

// Store for tracking online status
const userStatuses = new Map<string, UserOnlineStatus>();
let currentUserId: string | null = null;
let activityTimeout: ReturnType<typeof setTimeout> | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let isCurrentlyOnline = true;

/**
 * Initialize online status service
 */
export function initializeOnlineStatusService(userId: string): void {
  currentUserId = userId;
  isCurrentlyOnline = true;

  // Initialize current user status
  userStatuses.set(userId, {
    userId,
    isOnline: true,
    lastSeen: new Date(),
    lastActivity: new Date()
  });

  // Publish initial online status
  publishOnlineStatus(true);

  // Start heartbeat
  startHeartbeat();

  // Track activity
  trackActivity();

  console.log('[OnlineStatusService] Initialized for user:', userId);
}

/**
 * Track user activity (keyboard, mouse, touch)
 */
export function trackActivity(): void {
  if (!currentUserId) return;

  const status = userStatuses.get(currentUserId);
  if (!status) return;

  // Update last activity
  status.lastActivity = new Date();

  // If offline, mark as online
  if (!status.isOnline) {
    status.isOnline = true;
    status.lastSeen = new Date();
    isCurrentlyOnline = true;
    updateCurrentUserOnlineStatus(true);
    publishOnlineStatus(true);
    console.log('[OnlineStatusService] User came online');
  }

  // Clear existing timeout
  if (activityTimeout) {
    clearTimeout(activityTimeout);
  }

  // Set timeout to mark as offline
  activityTimeout = setTimeout(() => {
    markUserOffline();
  }, ACTIVITY_TIMEOUT);
}

/**
 * Mark current user as offline
 */
function markUserOffline(): void {
  if (!currentUserId) return;

  const status = userStatuses.get(currentUserId);
  if (!status || !status.isOnline) return;

  status.isOnline = false;
  status.lastSeen = new Date();
  isCurrentlyOnline = false;
  updateCurrentUserOnlineStatus(false);
  publishOnlineStatus(false);

  console.log('[OnlineStatusService] User went offline');
}

/**
 * Start heartbeat to keep user online
 */
function startHeartbeat(): void {
  heartbeatInterval = setInterval(() => {
    if (currentUserId) {
      const status = userStatuses.get(currentUserId);
      if (status && status.isOnline) {
        // Publish online status periodically
        publishOnlineStatus(true);
      }
    }
  }, HEARTBEAT_INTERVAL);
}

/**
 * Stop heartbeat
 */
function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

/**
 * Update user online status
 */
export function updateUserStatus(userId: string, isOnline: boolean, lastSeen?: Date): void {
  const now = new Date();

  if (!userStatuses.has(userId)) {
    userStatuses.set(userId, {
      userId,
      isOnline,
      lastSeen: lastSeen || now,
      lastActivity: now
    });
  } else {
    const status = userStatuses.get(userId)!;
    status.isOnline = isOnline;
    status.lastSeen = lastSeen || now;
    status.lastActivity = now;
  }

  // Update store
  updateUserOnlineStatus(userId, isOnline, lastSeen || now);
}

/**
 * Get user online status
 */
export function getUserStatus(userId: string): UserOnlineStatus | undefined {
  return userStatuses.get(userId);
}

/**
 * Check if user is online
 */
export function isUserOnline(userId: string): boolean {
  const status = userStatuses.get(userId);
  return status?.isOnline ?? false;
}

/**
 * Get last seen time for user
 */
export function getLastSeen(userId: string): Date | null {
  const status = userStatuses.get(userId);
  return status?.lastSeen ?? null;
}

/**
 * Format last seen time
 */
export function formatLastSeen(date: Date | null): string {
  if (!date) return 'Never';

  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // Less than 1 minute
  if (diff < 60000) {
    return 'Just now';
  }

  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  }

  // Less than 1 day
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }

  // Less than 1 week
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  }

  // Format as date
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric'
  };

  return date.toLocaleDateString('en-US', options);
}

/**
 * Get current online status
 */
export function getCurrentOnlineStatus(): boolean {
  return isCurrentlyOnline;
}

export function isRecentlyActive(status: OnlineStatus): boolean {
  if (status.isOnline) return true;
  if (!status.lastSeen) return false;
  const diff = Date.now() - status.lastSeen.getTime();
  return diff < 5 * 60 * 1000; // within last 5 minutes
}

/**
 * Clean up online status service
 */
export function cleanupOnlineStatusService(): void {
  // Mark as offline
  if (currentUserId) {
    const status = userStatuses.get(currentUserId);
    if (status) {
      status.isOnline = false;
      status.lastSeen = new Date();
      publishOnlineStatus(false);
    }
  }

  // Clear timers
  if (activityTimeout) {
    clearTimeout(activityTimeout);
    activityTimeout = null;
  }

  stopHeartbeat();

  // Clear states
  userStatuses.clear();
  currentUserId = null;
  isCurrentlyOnline = false;

  console.log('[OnlineStatusService] Cleaned up');
}

/**
 * Add activity listeners to document
 */
export function addActivityListeners(): void {
  if (typeof document === 'undefined') return;

  const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

  events.forEach((event) => {
    document.addEventListener(event, trackActivity, { passive: true });
  });
}

/**
 * Remove activity listeners from document
 */
export function removeActivityListeners(): void {
  if (typeof document === 'undefined') return;

  const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

  events.forEach((event) => {
    document.removeEventListener(event, trackActivity);
  });
}

/**
 * Track user as online (alias for initializeOnlineStatusService)
 */
export function trackUserOnline(userId: string): Promise<void> {
  return Promise.resolve().then(() => {
    initializeOnlineStatusService(userId);
  });
}

/**
 * Untrack user as offline (alias for cleanupOnlineStatusService)
 */
export function untrackUserOnline(): void {
  cleanupOnlineStatusService();
}

/**
 * Update last activity (alias for trackActivity)
 */
export function updateLastActivity(): void {
  trackActivity();
}

/**
 * Subscribe to user online status (for compatibility)
 */
export function subscribeToUserOnlineStatus(userId: string, callback: (status: { isOnline: boolean; lastSeen: Date | null }) => void): () => void {
  // Initial callback with current status
  const status = userStatuses.get(userId);
  if (status) {
    callback({
      isOnline: status.isOnline,
      lastSeen: status.lastSeen
    });
  }

  // Return unsubscribe function
  return () => {
    // No-op for now
  };
}
