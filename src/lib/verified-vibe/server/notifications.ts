/**
 * Notifications Server Module
 *
 * Handles server-side notification operations including:
 * - Creating notifications
 * - Storing notifications in database
 * - Sending push notifications
 * - Managing notification lifecycle
 */

import type { Notification } from '../types';

/**
 * Push notification configuration
 */
interface PushNotificationConfig {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>;
}

/**
 * Create a match notification
 *
 * @param userId - ID of the user receiving the notification
 * @param matchedUserId - ID of the matched user
 * @param matchedUserName - Name of the matched user
 * @param matchedUserPhoto - Photo URL of the matched user (optional)
 * @param matchId - ID of the match
 * @returns Notification object
 */
export function createMatchNotification(
  userId: string,
  matchedUserId: string,
  matchedUserName: string,
  matchedUserPhoto: string | undefined,
  matchId: string
): Notification {
  return {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    type: 'match',
    status: 'unread',
    title: 'New Match!',
    body: `You matched with ${matchedUserName}!`,
    data: {
      matchId,
      userId: matchedUserId,
      userName: matchedUserName,
      userPhoto: matchedUserPhoto,
      actionUrl: `/verified-vibe/chat/${matchId}`
    },
    createdAt: new Date()
  };
}

/**
 * Create a message notification
 *
 * @param userId - ID of the user receiving the notification
 * @param senderName - Name of the message sender
 * @param messagePreview - Preview of the message
 * @param matchId - ID of the match/conversation
 * @returns Notification object
 */
export function createMessageNotification(
  userId: string,
  senderName: string,
  messagePreview: string,
  matchId: string
): Notification {
  return {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    type: 'message',
    status: 'unread',
    title: 'New Message',
    body: `${senderName}: ${messagePreview}`,
    data: {
      matchId,
      actionUrl: `/verified-vibe/chat/${matchId}`
    },
    createdAt: new Date()
  };
}

/**
 * Create a verification notification
 *
 * @param userId - ID of the user receiving the notification
 * @param step - Verification step that was completed
 * @returns Notification object
 */
export function createVerificationNotification(
  userId: string,
  step: string
): Notification {
  const stepLabels: Record<string, string> = {
    id: 'ID Verification',
    liveness: 'Liveness Check',
    photos: 'Photo Verification',
    spending_or_qa: 'Q&A Completion'
  };

  return {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    type: 'verification',
    status: 'unread',
    title: 'Verification Complete',
    body: `${stepLabels[step] || step} has been verified!`,
    data: {
      actionUrl: '/verified-vibe/trust'
    },
    createdAt: new Date()
  };
}

/**
 * Create a system notification
 *
 * @param userId - ID of the user receiving the notification
 * @param title - Notification title
 * @param body - Notification body
 * @param actionUrl - Optional action URL
 * @returns Notification object
 */
export function createSystemNotification(
  userId: string,
  title: string,
  body: string,
  actionUrl?: string
): Notification {
  return {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    type: 'system',
    status: 'unread',
    title,
    body,
    data: {
      actionUrl
    },
    createdAt: new Date()
  };
}

/**
 * Convert notification to push notification config
 *
 * @param notification - Notification object
 * @returns Push notification configuration
 */
export function notificationToPushConfig(notification: Notification): PushNotificationConfig {
  const iconMap: Record<string, string> = {
    match: '💕',
    message: '💬',
    verification: '✓',
    system: 'ℹ️'
  };

  return {
    title: notification.title,
    body: notification.body,
    icon: iconMap[notification.type] || '🔔',
    tag: notification.type,
    data: notification.data
  };
}

/**
 * Send push notification (mock implementation)
 *
 * In production, this would integrate with:
 * - Firebase Cloud Messaging (FCM)
 * - Apple Push Notification service (APNs)
 * - Web Push API
 *
 * @param userId - ID of the user
 * @param config - Push notification configuration
 * @returns Promise that resolves when notification is sent
 */
export async function sendPushNotification(
  userId: string,
  config: PushNotificationConfig
): Promise<void> {
  try {
    // In production, this would:
    // 1. Get user's push subscription from database
    // 2. Send notification via FCM/APNs/Web Push API
    // 3. Handle failures and retries

    console.log('Push notification sent:', {
      userId,
      title: config.title,
      body: config.body,
      timestamp: new Date().toISOString()
    });

    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 100));
  } catch (error) {
    console.error('Failed to send push notification:', error);
    throw error;
  }
}

/**
 * Send notification to user
 *
 * Handles both in-app and push notifications
 *
 * @param notification - Notification object
 * @param sendPush - Whether to send push notification (default: true)
 * @returns Promise that resolves when notification is sent
 */
export async function sendNotification(
  notification: Notification,
  sendPush: boolean = true
): Promise<void> {
  try {
    // In production, this would:
    // 1. Store notification in database
    // 2. Send push notification if enabled
    // 3. Emit real-time update via WebSocket

    console.log('Notification created:', {
      notificationId: notification.id,
      userId: notification.userId,
      type: notification.type,
      timestamp: new Date().toISOString()
    });

    // Send push notification if enabled
    if (sendPush) {
      const pushConfig = notificationToPushConfig(notification);
      await sendPushNotification(notification.userId, pushConfig);
    }
  } catch (error) {
    console.error('Failed to send notification:', error);
    throw error;
  }
}

/**
 * Batch send notifications
 *
 * @param notifications - Array of notifications to send
 * @param sendPush - Whether to send push notifications (default: true)
 * @returns Promise that resolves when all notifications are sent
 */
export async function batchSendNotifications(
  notifications: Notification[],
  sendPush: boolean = true
): Promise<void> {
  try {
    const promises = notifications.map((notif) =>
      sendNotification(notif, sendPush).catch((error) => {
        console.error(`Failed to send notification ${notif.id}:`, error);
      })
    );

    await Promise.all(promises);
  } catch (error) {
    console.error('Failed to batch send notifications:', error);
    throw error;
  }
}

/**
 * Format notification for display
 *
 * @param notification - Notification object
 * @returns Formatted notification string
 */
export function formatNotification(notification: Notification): string {
  return `${notification.title}: ${notification.body}`;
}

/**
 * Get notification icon emoji
 *
 * @param type - Notification type
 * @returns Emoji icon
 */
export function getNotificationIcon(type: string): string {
  const iconMap: Record<string, string> = {
    match: '💕',
    message: '💬',
    verification: '✓',
    system: 'ℹ️'
  };

  return iconMap[type] || '🔔';
}

/**
 * Get notification color class
 *
 * @param type - Notification type
 * @returns CSS class name
 */
export function getNotificationColorClass(type: string): string {
  const colorMap: Record<string, string> = {
    match: 'notification-match',
    message: 'notification-message',
    verification: 'notification-verification',
    system: 'notification-system'
  };

  return colorMap[type] || 'notification-default';
}

/**
 * Check if notification is recent (within last hour)
 *
 * @param notification - Notification object
 * @returns True if notification is recent
 */
export function isRecentNotification(notification: Notification): boolean {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  return new Date(notification.createdAt) > oneHourAgo;
}

/**
 * Sort notifications by creation date (newest first)
 *
 * @param notifications - Array of notifications
 * @returns Sorted array
 */
export function sortNotificationsByDate(notifications: Notification[]): Notification[] {
  return [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Filter notifications by type
 *
 * @param notifications - Array of notifications
 * @param type - Notification type to filter by
 * @returns Filtered array
 */
export function filterNotificationsByType(
  notifications: Notification[],
  type: string
): Notification[] {
  return notifications.filter((n) => n.type === type);
}

/**
 * Filter unread notifications
 *
 * @param notifications - Array of notifications
 * @returns Filtered array of unread notifications
 */
export function getUnreadNotifications(notifications: Notification[]): Notification[] {
  return notifications.filter((n) => n.status === 'unread');
}

/**
 * Count unread notifications
 *
 * @param notifications - Array of notifications
 * @returns Count of unread notifications
 */
export function countUnreadNotifications(notifications: Notification[]): number {
  return getUnreadNotifications(notifications).length;
}
