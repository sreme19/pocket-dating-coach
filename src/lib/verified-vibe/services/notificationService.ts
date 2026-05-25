/**
 * Notification Service
 *
 * Handles in-app and push notifications for messages and other events.
 * Manages notification state, muting, and delivery.
 */

import type { Notification } from '../types';

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: NotificationAction[];
  data?: Record<string, any>;
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

/**
 * Check if browser supports notifications
 */
export function isNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window;
}

/**
 * Check if notifications are enabled
 */
export function areNotificationsEnabled(): boolean {
  if (!isNotificationSupported()) return false;
  return Notification.permission === 'granted';
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

/**
 * Send a push notification
 */
export function sendPushNotification(options: NotificationOptions): Notification | null {
  if (!areNotificationsEnabled()) {
    return null;
  }

  try {
    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon,
      badge: options.badge,
      tag: options.tag,
      requireInteraction: options.requireInteraction ?? false,
      data: options.data
    });

    return notification as unknown as Notification;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return null;
  }
}

/**
 * Send a message notification
 */
export function sendMessageNotification(
  senderName: string,
  messagePreview: string,
  conversationId: string,
  senderPhoto?: string
): Notification | null {
  return sendPushNotification({
    title: `Message from ${senderName}`,
    body: messagePreview,
    icon: senderPhoto,
    tag: `message_${conversationId}`,
    requireInteraction: false,
    data: {
      conversationId,
      actionUrl: `/verified-vibe/chat/${conversationId}`
    }
  });
}

/**
 * Send a match notification
 */
export function sendMatchNotification(
  matchedUserName: string,
  matchId: string,
  matchedUserPhoto?: string
): Notification | null {
  return sendPushNotification({
    title: 'New Match!',
    body: `You matched with ${matchedUserName}!`,
    icon: matchedUserPhoto,
    tag: `match_${matchId}`,
    requireInteraction: true,
    data: {
      matchId,
      actionUrl: `/verified-vibe/chat/${matchId}`
    }
  });
}

/**
 * Get notification muting status for a conversation
 */
export function getConversationMutingStatus(conversationId: string): boolean {
  if (typeof window === 'undefined') return false;

  const mutedConversations = localStorage.getItem('vv_muted_conversations');
  if (!mutedConversations) return false;

  try {
    const muted = JSON.parse(mutedConversations) as string[];
    return muted.includes(conversationId);
  } catch (error) {
    console.error('Error parsing muted conversations:', error);
    return false;
  }
}

/**
 * Set notification muting status for a conversation
 */
export function setConversationMutingStatus(conversationId: string, isMuted: boolean): void {
  if (typeof window === 'undefined') return;

  const mutedConversations = localStorage.getItem('vv_muted_conversations');
  let muted: string[] = [];

  if (mutedConversations) {
    try {
      muted = JSON.parse(mutedConversations);
    } catch (error) {
      console.error('Error parsing muted conversations:', error);
    }
  }

  if (isMuted) {
    if (!muted.includes(conversationId)) {
      muted.push(conversationId);
    }
  } else {
    muted = muted.filter((id) => id !== conversationId);
  }

  localStorage.setItem('vv_muted_conversations', JSON.stringify(muted));
}

/**
 * Toggle notification muting for a conversation
 */
export function toggleConversationMuting(conversationId: string): boolean {
  const isMuted = getConversationMutingStatus(conversationId);
  setConversationMutingStatus(conversationId, !isMuted);
  return !isMuted;
}

/**
 * Get all muted conversations
 */
export function getMutedConversations(): string[] {
  if (typeof window === 'undefined') return [];

  const mutedConversations = localStorage.getItem('vv_muted_conversations');
  if (!mutedConversations) return [];

  try {
    return JSON.parse(mutedConversations);
  } catch (error) {
    console.error('Error parsing muted conversations:', error);
    return [];
  }
}

/**
 * Clear all muted conversations
 */
export function clearMutedConversations(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('vv_muted_conversations');
}

/**
 * Format notification for display
 */
export function formatNotificationForDisplay(notification: Notification): {
  title: string;
  body: string;
  icon?: string;
  actionUrl?: string;
} {
  return {
    title: notification.title,
    body: notification.body,
    icon: notification.data?.userPhoto,
    actionUrl: notification.data?.actionUrl
  };
}

/**
 * Handle notification click
 */
export function handleNotificationClick(notification: Notification): void {
  const actionUrl = notification.data?.actionUrl;
  if (actionUrl && typeof window !== 'undefined') {
    window.location.href = actionUrl;
  }
}

/**
 * Check if app is in focus
 */
export function isAppInFocus(): boolean {
  if (typeof document === 'undefined') return false;
  return document.hasFocus();
}

/**
 * Show in-app notification (toast)
 * This is a placeholder - in production, use a toast library like svelte-sonner
 */
export function showInAppNotification(
  title: string,
  body: string,
  type: 'message' | 'match' | 'system' = 'system'
): void {
  if (typeof window === 'undefined') return;

  // Dispatch custom event that components can listen to
  const event = new CustomEvent('notification', {
    detail: { title, body, type }
  });

  window.dispatchEvent(event);
}

/**
 * Create notification from API response
 */
export function createNotificationFromResponse(data: any): Notification {
  return {
    id: data.id || `notif_${Date.now()}`,
    userId: data.userId,
    type: data.type || 'message',
    status: data.status || 'unread',
    title: data.title,
    body: data.body,
    data: data.data || {},
    createdAt: new Date(data.createdAt),
    readAt: data.readAt ? new Date(data.readAt) : undefined
  };
}
