/**
 * Notification Preferences API Endpoint
 *
 * Handles user notification preferences (get and update).
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Notification Preferences Type
 */
interface NotificationPreferences {
  userId: string;
  messageNotifications: boolean;
  matchNotifications: boolean;
  systemNotifications: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  doNotDisturbStart?: string; // HH:mm format
  doNotDisturbEnd?: string; // HH:mm format
  updatedAt: string;
}

/**
 * GET /api/verified-vibe/notification-preferences
 *
 * Get notification preferences for a user.
 *
 * Query parameters:
 * - userId: string (required) - The user ID
 *
 * Response:
 * {
 *   data: {
 *     preferences: NotificationPreferences
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
    const preferences: NotificationPreferences = {
      userId,
      messageNotifications: true,
      matchNotifications: true,
      systemNotifications: true,
      emailNotifications: false,
      pushNotifications: true,
      soundEnabled: true,
      vibrationEnabled: true,
      doNotDisturbStart: undefined,
      doNotDisturbEnd: undefined,
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
 * PUT /api/verified-vibe/notification-preferences
 *
 * Update notification preferences for a user.
 *
 * Request body:
 * {
 *   userId: string (required) - The user ID
 *   preferences: Partial<NotificationPreferences> (required) - Preferences to update
 * }
 *
 * Response:
 * {
 *   data: {
 *     preferences: NotificationPreferences
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

    // Validate preference values if provided
    if (preferences.messageNotifications !== undefined && typeof preferences.messageNotifications !== 'boolean') {
      return json(
        { error: 'messageNotifications must be a boolean' },
        { status: 400 }
      );
    }

    if (preferences.matchNotifications !== undefined && typeof preferences.matchNotifications !== 'boolean') {
      return json(
        { error: 'matchNotifications must be a boolean' },
        { status: 400 }
      );
    }

    if (preferences.systemNotifications !== undefined && typeof preferences.systemNotifications !== 'boolean') {
      return json(
        { error: 'systemNotifications must be a boolean' },
        { status: 400 }
      );
    }

    if (preferences.emailNotifications !== undefined && typeof preferences.emailNotifications !== 'boolean') {
      return json(
        { error: 'emailNotifications must be a boolean' },
        { status: 400 }
      );
    }

    if (preferences.pushNotifications !== undefined && typeof preferences.pushNotifications !== 'boolean') {
      return json(
        { error: 'pushNotifications must be a boolean' },
        { status: 400 }
      );
    }

    if (preferences.soundEnabled !== undefined && typeof preferences.soundEnabled !== 'boolean') {
      return json(
        { error: 'soundEnabled must be a boolean' },
        { status: 400 }
      );
    }

    if (preferences.vibrationEnabled !== undefined && typeof preferences.vibrationEnabled !== 'boolean') {
      return json(
        { error: 'vibrationEnabled must be a boolean' },
        { status: 400 }
      );
    }

    // Validate DND times if provided
    if (preferences.doNotDisturbStart !== undefined) {
      if (typeof preferences.doNotDisturbStart !== 'string' || !/^\d{2}:\d{2}$/.test(preferences.doNotDisturbStart)) {
        return json(
          { error: 'doNotDisturbStart must be in HH:mm format' },
          { status: 400 }
        );
      }
    }

    if (preferences.doNotDisturbEnd !== undefined) {
      if (typeof preferences.doNotDisturbEnd !== 'string' || !/^\d{2}:\d{2}$/.test(preferences.doNotDisturbEnd)) {
        return json(
          { error: 'doNotDisturbEnd must be in HH:mm format' },
          { status: 400 }
        );
      }
    }

    // In a real implementation, you would:
    // 1. Update preferences in database
    // 2. Return updated preferences

    const updatedPreferences: NotificationPreferences = {
      userId,
      messageNotifications: preferences.messageNotifications ?? true,
      matchNotifications: preferences.matchNotifications ?? true,
      systemNotifications: preferences.systemNotifications ?? true,
      emailNotifications: preferences.emailNotifications ?? false,
      pushNotifications: preferences.pushNotifications ?? true,
      soundEnabled: preferences.soundEnabled ?? true,
      vibrationEnabled: preferences.vibrationEnabled ?? true,
      doNotDisturbStart: preferences.doNotDisturbStart,
      doNotDisturbEnd: preferences.doNotDisturbEnd,
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
