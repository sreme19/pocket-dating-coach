// Verified Vibe — Global State Management

import { writable, derived } from 'svelte/store';
import type {
  VerifiedVibeUser,
  Match,
  Message,
  Notification,
  VerificationRecord,
  TrustScore,
  DiscoveryProfile,
  Phase,
  Tab,
  UIState
} from './types';

// ============================================================================
// USER STORE
// ============================================================================

/**
 * Current authenticated user
 * Persisted to localStorage
 */
function createUserStore() {
  const { subscribe, set, update } = writable<VerifiedVibeUser | null>(null);

  return {
    subscribe,
    set: (user: VerifiedVibeUser | null) => {
      set(user);
      if (typeof window !== 'undefined') {
        if (user) {
          localStorage.setItem('vv_user', JSON.stringify(user));
        } else {
          localStorage.removeItem('vv_user');
        }
      }
    },
    update: (fn: (user: VerifiedVibeUser | null) => VerifiedVibeUser | null) => {
      update((user) => {
        const updated = fn(user);
        if (typeof window !== 'undefined') {
          if (updated) {
            localStorage.setItem('vv_user', JSON.stringify(updated));
          } else {
            localStorage.removeItem('vv_user');
          }
        }
        return updated;
      });
    },
    hydrate: () => {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('vv_user');
        if (stored) {
          try {
            const user = JSON.parse(stored);
            set(user);
          } catch (e) {
            console.error('Failed to hydrate user store:', e);
          }
        }
      }
    },
    clear: () => {
      set(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('vv_user');
      }
    }
  };
}

export const user = createUserStore();

/**
 * User's trust score breakdown
 */
export const userTrust = writable<TrustScore | null>(null);

/**
 * User's verification records (one per step)
 */
export const userVerification = writable<VerificationRecord[]>([]);

// ============================================================================
// MATCHES STORE
// ============================================================================

/**
 * All matches for current user
 */
export const matches = writable<Match[]>([]);

/**
 * Currently active match (for chat)
 */
export const currentMatch = writable<VerifiedVibeUser | null>(null);

/**
 * Current match ID (for chat)
 */
export const currentMatchId = writable<string | null>(null);

// ============================================================================
// MESSAGES STORE
// ============================================================================

/**
 * Messages for current match
 */
export const messages = writable<Message[]>([]);

/**
 * Whether the other user is typing
 */
export const isTyping = writable(false);

/**
 * Unread message count
 */
export const unreadCount = writable(0);

// ============================================================================
// NOTIFICATIONS STORE
// ============================================================================

/**
 * All notifications for current user
 */
export const notifications = writable<Notification[]>([]);

/**
 * Unread notification count
 */
export const unreadNotifications = writable(0);

/**
 * Whether notifications are enabled
 */
export const notificationsEnabled = writable(true);

// ============================================================================
// DISCOVERY STORE
// ============================================================================

/**
 * Discovery profiles (card stack)
 */
export const discoveryProfiles = writable<DiscoveryProfile[]>([]);

/**
 * Current discovery card index
 */
export const discoveryIndex = writable(0);

/**
 * Whether discovery is loading more profiles
 */
export const discoveryLoading = writable(false);

/**
 * Blocked user IDs
 */
export const blockedUsers = writable<string[]>([]);

/**
 * Current discovery profile (derived from profiles and index)
 */
export const currentDiscoveryProfile = derived(
  [discoveryProfiles, discoveryIndex],
  ([$profiles, $index]) => {
    return $profiles[$index] || null;
  }
);

// ============================================================================
// UI STATE STORE
// ============================================================================

/**
 * Current phase of the app
 * Persisted to localStorage
 */
function createPhaseStore() {
  const { subscribe, set } = writable<Phase>('gate');

  return {
    subscribe,
    set: (phase: Phase) => {
      set(phase);
      if (typeof window !== 'undefined') {
        localStorage.setItem('vv_phase', phase);
      }
    },
    hydrate: () => {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('vv_phase');
        if (stored) {
          set(stored as Phase);
        }
      }
    }
  };
}

export const currentPhase = createPhaseStore();

/**
 * Current tab (for app phase)
 * Persisted to localStorage
 */
function createTabStore() {
  const { subscribe, set } = writable<Tab>('discover');

  return {
    subscribe,
    set: (tab: Tab) => {
      set(tab);
      if (typeof window !== 'undefined') {
        localStorage.setItem('vv_tab', tab);
      }
    },
    hydrate: () => {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('vv_tab');
        if (stored) {
          set(stored as Tab);
        }
      }
    }
  };
}

export const currentTab = createTabStore();

/**
 * Global loading state
 */
export const loading = writable(false);

/**
 * Global error message
 */
export const error = writable<string | null>(null);

/**
 * Verification progress (0-100)
 */
export const verificationProgress = writable(0);

/**
 * Current verification step (1-4)
 */
export const verificationStep = writable(1);

// ============================================================================
// DERIVED STORES
// ============================================================================

/**
 * Whether user is authenticated
 */
export const isAuthenticated = derived(user, ($user) => $user !== null);

/**
 * Whether user has completed verification
 */
export const isVerified = derived(userVerification, ($verification) => {
  if ($verification.length === 0) return false;
  return $verification.every((v) => v.status === 'completed');
});

/**
 * Whether user is in app phase (can access discovery, trust, chat)
 */
export const isInApp = derived(currentPhase, ($phase) => $phase === 'app');

/**
 * Total unread messages across all matches
 */
export const totalUnreadMessages = derived(unreadCount, ($count) => $count);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Initialize stores from localStorage
 * Call this on app mount
 */
export function hydrateStores() {
  user.hydrate();
  currentPhase.hydrate();
  currentTab.hydrate();
}

/**
 * Clear all user data (logout)
 */
export function clearAllStores() {
  user.clear();
  userTrust.set(null);
  userVerification.set([]);
  matches.set([]);
  currentMatch.set(null);
  currentMatchId.set(null);
  messages.set([]);
  isTyping.set(false);
  unreadCount.set(0);
  notifications.set([]);
  unreadNotifications.set(0);
  discoveryProfiles.set([]);
  discoveryIndex.set(0);
  discoveryLoading.set(false);
  blockedUsers.set([]);
  loading.set(false);
  error.set(null);
  verificationProgress.set(0);
  verificationStep.set(1);
  currentPhase.set('gate');
  currentTab.set('discover');

  if (typeof window !== 'undefined') {
    localStorage.removeItem('vv_user');
    localStorage.removeItem('vv_phase');
    localStorage.removeItem('vv_tab');
  }
}

/**
 * Reset error message
 */
export function clearError() {
  error.set(null);
}

/**
 * Set error message
 */
export function setError(message: string) {
  error.set(message);
}

/**
 * Set current phase
 */
export function setPhase(phase: Phase) {
  currentPhase.set(phase);
}

/**
 * Update user profile
 */
export function updateUser(updates: Partial<VerifiedVibeUser>) {
  user.update((u) => {
    if (!u) return u;
    return { ...u, ...updates, updatedAt: new Date() };
  });
}

/**
 * Update trust score
 */
export function updateTrustScore(trust: TrustScore) {
  userTrust.set(trust);
}

/**
 * Add verification record
 */
export function addVerificationRecord(record: VerificationRecord) {
  userVerification.update((records) => {
    const existing = records.findIndex((r) => r.step === record.step);
    if (existing >= 0) {
      records[existing] = record;
    } else {
      records.push(record);
    }
    return records;
  });
}

/**
 * Add message to current chat
 */
export function addMessage(message: Message) {
  messages.update((msgs) => [...msgs, message]);
}

/**
 * Add match
 */
export function addMatch(match: Match) {
  matches.update((m) => [...m, match]);
}

/**
 * Add discovery profile
 */
export function addDiscoveryProfile(profile: DiscoveryProfile) {
  discoveryProfiles.update((profiles) => [...profiles, profile]);
}

/**
 * Move to next discovery profile
 */
export function nextDiscoveryProfile() {
  discoveryIndex.update((i) => i + 1);
}

/**
 * Reset discovery to first profile
 */
export function resetDiscovery() {
  discoveryIndex.set(0);
  discoveryProfiles.set([]);
}

/**
 * Set current match for chat
 */
export function setCurrentMatch(matchId: string, profile: VerifiedVibeUser) {
  currentMatchId.set(matchId);
  currentMatch.set(profile);
  messages.set([]);
}

/**
 * Clear current match
 */
export function clearCurrentMatch() {
  currentMatchId.set(null);
  currentMatch.set(null);
  messages.set([]);
}

// ============================================================================
// NOTIFICATION HELPERS
// ============================================================================

/**
 * Add notification
 */
export function addNotification(notification: Notification) {
  notifications.update((notifs) => [notification, ...notifs]);
  unreadNotifications.update((count) => count + 1);
}

/**
 * Mark notification as read
 */
export function markNotificationAsRead(notificationId: string) {
  notifications.update((notifs) =>
    notifs.map((n) =>
      n.id === notificationId
        ? { ...n, status: 'read' as const, readAt: new Date() }
        : n
    )
  );
  unreadNotifications.update((count) => Math.max(0, count - 1));
}

/**
 * Mark all notifications as read
 */
export function markAllNotificationsAsRead() {
  notifications.update((notifs) =>
    notifs.map((n) => ({
      ...n,
      status: 'read' as const,
      readAt: n.readAt || new Date()
    }))
  );
  unreadNotifications.set(0);
}

/**
 * Delete notification
 */
export function deleteNotification(notificationId: string) {
  notifications.update((notifs) => {
    const notification = notifs.find((n) => n.id === notificationId);
    if (notification && notification.status === 'unread') {
      unreadNotifications.update((count) => Math.max(0, count - 1));
    }
    return notifs.filter((n) => n.id !== notificationId);
  });
}

/**
 * Clear all notifications
 */
export function clearAllNotifications() {
  notifications.set([]);
  unreadNotifications.set(0);
}

// ============================================================================
// BLOCKED USERS HELPERS
// ============================================================================

/**
 * Add user to blocked list
 */
export function blockUser(userId: string) {
  blockedUsers.update((blocked) => {
    if (!blocked.includes(userId)) {
      return [...blocked, userId];
    }
    return blocked;
  });
}

/**
 * Remove user from blocked list
 */
export function unblockUser(userId: string) {
  blockedUsers.update((blocked) => blocked.filter((id) => id !== userId));
}

/**
 * Check if user is blocked
 */
export function isUserBlocked(userId: string): boolean {
  let blocked = false;
  blockedUsers.subscribe((blockedList) => {
    blocked = blockedList.includes(userId);
  })();
  return blocked;
}

// ============================================================================
// ONLINE STATUS STORE
// ============================================================================

/**
 * Online status of the current match user
 */
export const matchUserOnlineStatus = writable<{
  isOnline: boolean;
  lastSeen: Date | null;
} | null>(null);

/**
 * Whether the current user is online
 */
export const currentUserOnline = writable(true);

/**
 * Map of user IDs to their online status
 */
export const userOnlineStatuses = writable<Record<string, { isOnline: boolean; lastSeen: Date | null }>>({});

/**
 * Update match user online status
 */
export function updateMatchUserOnlineStatus(isOnline: boolean, lastSeen: Date | null) {
  matchUserOnlineStatus.set({ isOnline, lastSeen });
}

/**
 * Update current user online status
 */
export function updateCurrentUserOnlineStatus(isOnline: boolean) {
  currentUserOnline.set(isOnline);
}

/**
 * Update a user's online status in the map
 */
export function updateUserOnlineStatus(userId: string, isOnline: boolean, lastSeen: Date | null) {
  userOnlineStatuses.update((statuses) => ({
    ...statuses,
    [userId]: { isOnline, lastSeen }
  }));
}
