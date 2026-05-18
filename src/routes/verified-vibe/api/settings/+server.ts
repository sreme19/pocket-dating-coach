/**
 * Settings API Endpoint
 *
 * Handles user settings management (get and update).
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * User Settings Type
 */
interface UserSettings {
  userId: string;
  profile: {
    firstName: string;
    lastName?: string;
    bio?: string;
    interests?: string[];
    lookingFor?: string;
  };
  account: {
    email: string;
    phone?: string;
    username: string;
  };
  preferences: {
    language: string;
    timezone: string;
    theme: string;
  };
  updatedAt: string;
}

/**
 * GET /api/verified-vibe/settings
 *
 * Get user settings.
 *
 * Query parameters:
 * - userId: string (required) - The user ID
 *
 * Response:
 * {
 *   data: {
 *     settings: UserSettings
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
    // 1. Query settings from database
    // 2. Return user's settings

    // For now, return mock data
    const settings: UserSettings = {
      userId,
      profile: {
        firstName: 'John',
        lastName: 'Doe',
        bio: 'Adventure seeker and coffee enthusiast',
        interests: ['hiking', 'reading', 'cooking'],
        lookingFor: 'Someone who enjoys outdoor activities'
      },
      account: {
        email: 'john@example.com',
        phone: '+1-555-0123',
        username: 'johndoe'
      },
      preferences: {
        language: 'en',
        timezone: 'America/New_York',
        theme: 'light'
      },
      updatedAt: new Date().toISOString()
    };

    return json({
      data: {
        settings
      }
    });
  } catch (error) {
    console.error('Settings API error:', error);
    return json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
};

/**
 * PUT /api/verified-vibe/settings
 *
 * Update user settings.
 *
 * Request body:
 * {
 *   userId: string (required) - The user ID
 *   settings: Partial<UserSettings> (required) - Settings to update
 * }
 *
 * Response:
 * {
 *   data: {
 *     settings: UserSettings
 *   }
 * }
 */
export const PUT: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();

    const { userId, settings } = body;

    // Validate required fields
    if (!userId) {
      return json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    if (!settings || typeof settings !== 'object') {
      return json(
        { error: 'Missing or invalid settings' },
        { status: 400 }
      );
    }

    // Validate profile settings if provided
    if (settings.profile) {
      if (settings.profile.firstName && !settings.profile.firstName.trim()) {
        return json(
          { error: 'First name cannot be empty' },
          { status: 400 }
        );
      }

      if (settings.profile.firstName && settings.profile.firstName.length > 50) {
        return json(
          { error: 'First name must be less than 50 characters' },
          { status: 400 }
        );
      }

      if (settings.profile.bio && settings.profile.bio.length > 500) {
        return json(
          { error: 'Bio must be less than 500 characters' },
          { status: 400 }
        );
      }

      if (settings.profile.lookingFor && settings.profile.lookingFor.length > 200) {
        return json(
          { error: 'Looking for must be less than 200 characters' },
          { status: 400 }
        );
      }
    }

    // Validate account settings if provided
    if (settings.account) {
      if (settings.account.email && !settings.account.email.trim()) {
        return json(
          { error: 'Email cannot be empty' },
          { status: 400 }
        );
      }

      if (settings.account.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(settings.account.email)) {
          return json(
            { error: 'Invalid email address' },
            { status: 400 }
          );
        }
      }

      if (settings.account.username && !settings.account.username.trim()) {
        return json(
          { error: 'Username cannot be empty' },
          { status: 400 }
        );
      }

      if (settings.account.username && settings.account.username.length < 3) {
        return json(
          { error: 'Username must be at least 3 characters' },
          { status: 400 }
        );
      }

      if (settings.account.username && settings.account.username.length > 30) {
        return json(
          { error: 'Username must be less than 30 characters' },
          { status: 400 }
        );
      }

      if (settings.account.username && !/^[a-zA-Z0-9_-]+$/.test(settings.account.username)) {
        return json(
          { error: 'Username can only contain letters, numbers, underscores, and hyphens' },
          { status: 400 }
        );
      }
    }

    // Validate preferences if provided
    if (settings.preferences) {
      const validLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh'];
      if (settings.preferences.language && !validLanguages.includes(settings.preferences.language)) {
        return json(
          { error: 'Invalid language' },
          { status: 400 }
        );
      }

      const validThemes = ['light', 'dark', 'auto'];
      if (settings.preferences.theme && !validThemes.includes(settings.preferences.theme)) {
        return json(
          { error: 'Invalid theme' },
          { status: 400 }
        );
      }
    }

    // In a real implementation, you would:
    // 1. Update settings in database
    // 2. Return updated settings

    const updatedSettings: UserSettings = {
      userId,
      profile: settings.profile || {},
      account: settings.account || {},
      preferences: settings.preferences || {},
      updatedAt: new Date().toISOString()
    };

    console.log(`[Settings API] Settings updated for user ${userId}`);

    return json({
      data: {
        settings: updatedSettings
      }
    });
  } catch (error) {
    console.error('Settings API error:', error);
    return json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
};
