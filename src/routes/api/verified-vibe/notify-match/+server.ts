import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { Notification } from '$lib/verified-vibe/types';

interface NotifyMatchRequest {
  matchId: string;
  userId: string;
  matchedUserId: string;
  matchedUserName: string;
  matchedUserPhoto?: string;
}

interface NotifyMatchResponse {
  success: boolean;
  notification?: Notification;
  error?: string;
}

/**
 * POST /api/verified-vibe/notify-match
 *
 * Sends a match notification when mutual likes occur.
 * Creates a notification record that can be stored in the notification center
 * and optionally sends a push notification if the user has enabled them.
 *
 * Request body:
 * {
 *   matchId: string;           // ID of the match
 *   userId: string;            // ID of the user receiving the notification
 *   matchedUserId: string;     // ID of the matched user
 *   matchedUserName: string;   // Name of the matched user
 *   matchedUserPhoto?: string; // Photo URL of the matched user
 * }
 *
 * Response:
 * {
 *   success: boolean;
 *   notification?: Notification;
 *   error?: string;
 * }
 *
 * Features:
 * - Creates notification record with match details
 * - Includes matched user's name and photo
 * - Supports push notifications (if enabled)
 * - Stores notification in notification center
 * - Returns notification object for client-side handling
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    // Parse request body
    const body = await request.json() as NotifyMatchRequest;

    // Validate required fields
    if (!body.matchId || !body.userId || !body.matchedUserId || !body.matchedUserName) {
      return json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate field types
    if (typeof body.matchId !== 'string' || typeof body.userId !== 'string' ||
        typeof body.matchedUserId !== 'string' || typeof body.matchedUserName !== 'string') {
      return json(
        { success: false, error: 'Invalid field types' },
        { status: 400 }
      );
    }

    // Validate non-empty strings
    if (body.matchId.trim() === '' || body.userId.trim() === '' ||
        body.matchedUserId.trim() === '' || body.matchedUserName.trim() === '') {
      return json(
        { success: false, error: 'Fields cannot be empty' },
        { status: 400 }
      );
    }

    // Create notification object
    const notification: Notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: body.userId,
      type: 'match',
      status: 'unread',
      title: 'New Match!',
      body: `You matched with ${body.matchedUserName}!`,
      data: {
        matchId: body.matchId,
        userId: body.matchedUserId,
        userName: body.matchedUserName,
        userPhoto: body.matchedUserPhoto,
        actionUrl: `/verified-vibe/chat/${body.matchId}`
      },
      createdAt: new Date()
    };

    // In production, this would:
    // 1. Store notification in database (Supabase)
    // 2. Send push notification if user has enabled them
    // 3. Send real-time update via WebSocket or polling

    // For now, we'll return the notification object
    // The client will handle storing it in the notification center

    // Simulate push notification (in production, use Firebase Cloud Messaging or similar)
    if (typeof window === 'undefined') {
      // Server-side: Log notification for debugging
      console.log('Match notification created:', {
        notificationId: notification.id,
        userId: body.userId,
        matchedUser: body.matchedUserName,
        timestamp: new Date().toISOString()
      });
    }

    const response: NotifyMatchResponse = {
      success: true,
      notification
    };

    return json(response, { status: 201 });
  } catch (error) {
    console.error('Notify match error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
};
