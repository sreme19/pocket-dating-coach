/**
 * Extended Notification Preferences API Endpoint
 *
 * Handles extended notification preferences management (get and update).
 * Includes message, match, system, and marketing notifications with frequency controls.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Extended Notification Preferences Type
 */
interface ExtendedNotificationPreferences {
  userId: string;
  // Message notifications
  messageNotifications: boolean;
  messageFrequency: string;
  messageEmail: boolean;
  messagePush: boolean;
  messageSms: boolean;
  // Match notifications
  matchNotifications: boolean;
  matchFrequency: string;
  matchEmail: boolean;
  matchPush: boolean;
  matchSms: boolean;
  // System notifications
  systemNotifications: boolean;
  systemFrequency: string;
  systemEmail: boolean;
  systemPush: boolean;
  systemSms: boolean;
  // Marketing notifications
  marketingNotifications: boolean;
  marketingFrequency: string;
  marketingEmail: boolean;
  marketingPush: boolean;
  // Do Not Disturb
  dndEnabled: boolean;
  dndStartTime?: string;
  dndEndTime?: string;
  updatedAt: string;
}

/**
 * GET /api/verified-vibe/notification-preferences-extended
 *
 * Get extended notification preferences for a user.
 *
 * Query parameters:
 * - userId: string (required) - The user ID
 *
 * Response:
 * {
 *   data: {
 *     preferences: ExtendedNotificationPreferences
 *   }
 * }
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const userId = url.searchParams.get('userId');

    // Validate required fields
    if (!userId) {
      return json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    // In a real implementation, you would:
    // 1. Query notification preferences from database
    // 2. Return user's preferences or defaults

    // For now, return default preferences
    const preferences: ExtendedNotificationPreferences = {
      userId,
      messageNotifications: true,
      messageFrequency: 'immediate',
      messageEmail: true,
      messagePush: true,
      messageSms: false,
      matchNotifications: true,
      matchFrequency: 'immediate',
      matchEmail: true,
      matchPush: true,
      matchSms: false,
      systemNotifications: true,
      systemFrequency: 'immediate',
      systemEmail: false,
      systemPush: true,
      systemSms: false,
      marketingNotifications: false,
      marketingFrequency: 'weekly',
      marketingEmail: false,
      marketingPush: false,
      dndEnabled: false,
      dndStartTime: '22:00',
      dndEndTime: '08:00',
      updatedAt: new Date().toISOString()
    };

    return json({
      data: {
        preferences
      }
    });
  } catch (error) {
    console.error('Notification preferences API error:', error);
    return json(
      { error: 'Failed to fetch notification preferences' },
      { status: 500 }
    );
  }
};

/**
 * PUT /api/verified-vibe/notification-preferences-extended
 *
 * Update extended notification preferences for a user.
 *
 * Request body:
 * {
 *   userId: string (required) - The user ID
 *   preferences: Partial<ExtendedNotificationPreferences> (required) - Preferences to update
 * }
 *
 * Response:
 * {
 *   data: {
 *     preferences: ExtendedNotificationPreferences
 *   }
 * }
 */
export const PUT: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();

    const { userId, preferences } = body;

    // Validate required fields
    if (!userId) {
      return json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    if (!preferences || typeof preferences !== 'object') {
      return json(
        { error: 'Missing or invalid preferences' },
        { status: 400 }
      );
    }

    // Validate boolean fields
    const booleanFields = [
      'messageNotifications',
      'messageEmail',
      'messagePush',
      'messageSms',
      'matchNotifications',
      'matchEmail',
      'matchPush',
      'matchSms',
      'systemNotifications',
      'systemEmail',
      'systemPush',
      'systemSms',
      'marketingNotifications',
      'marketingEmail',
      'marketingPush',
      'dndEnabled'
    ];

    for (const field of booleanFields) {
      if (preferences[field] !== undefined && typeof preferences[field] !== 'boolean') {
        return json(
          { error: `${field} must be a boolean` },
          { status: 400 }
        );
      }
    }

    // Validate frequency fields
    const frequencyFields = ['messageFrequency', 'matchFrequency', 'systemFrequency', 'marketingFrequency'];
    const validFrequencies = ['immediate', 'daily', 'weekly'];

    for (const field of frequencyFields) {
      if (preferences[field] && !validFrequencies.includes(preferences[field])) {
        return json(
          { error: `${field} must be one of: immediate, daily, weekly` },
          { status: 400 }
        );
      }
    }

    // Validate DND times if provided
    if (preferences.dndStartTime !== undefined) {
      if (typeof preferences.dndStartTime !== 'string' || !/^\d{2}:\d{2}$/.test(preferences.dndStartTime)) {
        return json(
          { error: 'dndStartTime must be in HH:mm format' },
          { status: 400 }
        );
      }
    }

    if (preferences.dndEndTime !== undefined) {
      if (typeof preferences.dndEndTime !== 'string' || !/^\d{2}:\d{2}$/.test(preferences.dndEndTime)) {
        return json(
          { error: 'dndEndTime must be in HH:mm format' },
          { status: 400 }
        );
      }
    }

    // In a real implementation, you would:
    // 1. Update preferences in database
    // 2. Return updated preferences

    const updatedPreferences: ExtendedNotificationPreferences = {
      userId,
      messageNotifications: preferences.messageNotifications ?? true,
      messageFrequency: preferences.messageFrequency ?? 'immediate',
      messageEmail: preferences.messageEmail ?? true,
      messagePush: preferences.messagePush ?? true,
      messageSms: preferences.messageSms ?? false,
      matchNotifications: preferences.matchNotifications ?? true,
      matchFrequency: preferences.matchFrequency ?? 'immediate',
      matchEmail: preferences.matchEmail ?? true,
      matchPush: preferences.matchPush ?? true,
      matchSms: preferences.matchSms ?? false,
      systemNotifications: preferences.systemNotifications ?? true,
      systemFrequency: preferences.systemFrequency ?? 'immediate',
      systemEmail: preferences.systemEmail ?? false,
      systemPush: preferences.systemPush ?? true,
      systemSms: preferences.systemSms ?? false,
      marketingNotifications: preferences.marketingNotifications ?? false,
      marketingFrequency: preferences.marketingFrequency ?? 'weekly',
      marketingEmail: preferences.marketingEmail ?? false,
      marketingPush: preferences.marketingPush ?? false,
      dndEnabled: preferences.dndEnabled ?? false,
      dndStartTime: preferences.dndStartTime ?? '22:00',
      dndEndTime: preferences.dndEndTime ?? '08:00',
      updatedAt: new Date().toISOString()
    };

    console.log(`[Notification Preferences API] Preferences updated for user ${userId}`);

    return json({
      data: {
        preferences: updatedPreferences
      }
    });
  } catch (error) {
    console.error('Notification preferences API error:', error);
    return json(
      { error: 'Failed to update notification preferences' },
      { status: 500 }
    );
  }
};

/**
 * POST /api/verified-vibe/notification-preferences-extended/test
 *
 * Send a test notification to the user.
 *
 * Request body:
 * {
 *   userId: string (required) - The user ID
 *   type: string (optional) - Notification type (message, match, system)
 * }
 *
 * Response:
 * {
 *   data: {
 *     success: boolean,
 *     message: string
 *   }
 * }
 */
export const POST: RequestHandler = async ({ request, url }) => {
  try {
    // Check if this is a test notification request
    if (url.pathname.includes('/test')) {
      const body = await request.json();
      const { userId, type } = body;

      if (!userId) {
        return json(
          { error: 'Missing userId' },
          { status: 400 }
        );
      }

      const notificationType = type || 'system';
      const validTypes = ['message', 'match', 'system'];

      if (!validTypes.includes(notificationType)) {
        return json(
          { error: 'Invalid notification type' },
          { status: 400 }
        );
      }

      // In a real implementation, you would:
      // 1. Send test notification via email/push/SMS
      // 2. Log the test notification

      console.log(`[Notification Preferences API] Test ${notificationType} notification sent to user ${userId}`);

      return json({
        data: {
          success: true,
          message: `Test ${notificationType} notification sent`
        }
      });
    }

    return json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Notification preferences API error:', error);
    return json(
      { error: 'Failed to send test notification' },
      { status: 500 }
    );
  }
};
