/**
 * Online Status API Endpoint
 *
 * Handles user online status tracking and updates.
 * Broadcasts online/offline status to other users.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * POST /api/verified-vibe/online-status
 *
 * Update user online status.
 *
 * Request body:
 * {
 *   userId: string (required) - The user ID
 *   isOnline: boolean (required) - Whether the user is online
 * }
 *
 * Response:
 * {
 *   data: {
 *     success: boolean,
 *     userId: string,
 *     isOnline: boolean,
 *     timestamp: string
 *   }
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();

    const { userId, isOnline } = body;

    // Validate required fields
    if (!userId) {
      return json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    if (typeof isOnline !== 'boolean') {
      return json(
        { error: 'isOnline must be a boolean' },
        { status: 400 }
      );
    }

    // In a real implementation, you would:
    // 1. Update user online status in database
    // 2. Update last seen timestamp
    // 3. Broadcast status change to other users via WebSocket
    // 4. Store status in cache (Redis) for quick lookup

    const timestamp = new Date().toISOString();

    console.log(`[Online Status API] User ${userId} is ${isOnline ? 'online' : 'offline'}`);

    return json({
      data: {
        success: true,
        userId,
        isOnline,
        timestamp
      }
    });
  } catch (error) {
    console.error('Online Status API error:', error);
    return json(
      { error: 'Failed to update online status' },
      { status: 500 }
    );
  }
};

/**
 * GET /api/verified-vibe/online-status
 *
 * Get online status for a user or list of users.
 *
 * Query parameters:
 * - userId: string (optional) - Single user ID
 * - userIds: string (optional) - Comma-separated list of user IDs
 *
 * Response:
 * {
 *   data: {
 *     users: Array<{
 *       userId: string,
 *       isOnline: boolean,
 *       lastSeen: string (ISO date)
 *     }>
 *   }
 * }
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const userId = url.searchParams.get('userId');
    const userIds = url.searchParams.get('userIds');

    // Determine which users to fetch
    let usersToFetch: string[] = [];

    if (userId) {
      usersToFetch = [userId];
    } else if (userIds) {
      usersToFetch = userIds.split(',').filter((id) => id.trim());
    }

    if (usersToFetch.length === 0) {
      return json(
        { error: 'Missing userId or userIds' },
        { status: 400 }
      );
    }

    // In a real implementation, you would:
    // 1. Query database or cache for user online status
    // 2. Return list of users with their status

    // For now, return mock data
    const users = usersToFetch.map((id) => ({
      userId: id,
      isOnline: Math.random() > 0.5, // Mock: random online status
      lastSeen: new Date(Date.now() - Math.random() * 3600000).toISOString() // Mock: random last seen
    }));

    return json({
      data: {
        users
      }
    });
  } catch (error) {
    console.error('Online Status API error:', error);
    return json(
      { error: 'Failed to fetch online status' },
      { status: 500 }
    );
  }
};

/**
 * DELETE /api/verified-vibe/online-status
 *
 * Mark user as offline (logout).
 *
 * Query parameters:
 * - userId: string (required) - The user ID
 *
 * Response:
 * {
 *   data: {
 *     success: boolean
 *   }
 * }
 */
export const DELETE: RequestHandler = async ({ url }) => {
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
    // 1. Mark user as offline in database
    // 2. Update last seen timestamp
    // 3. Broadcast offline status to other users
    // 4. Clean up user sessions

    console.log(`[Online Status API] User ${userId} logged out`);

    return json({
      data: {
        success: true
      }
    });
  } catch (error) {
    console.error('Online Status API error:', error);
    return json(
      { error: 'Failed to mark user offline' },
      { status: 500 }
    );
  }
};
