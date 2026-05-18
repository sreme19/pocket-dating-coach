import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

interface BlockUserRequest {
  blockedUserId: string;
}

interface BlockUserResponse {
  data: {
    success: boolean;
    message: string;
    blockedUserId: string;
  };
}

/**
 * POST /api/verified-vibe/block-user
 *
 * Blocks a user from appearing in the discovery feed.
 * The blocked user will not be able to see the current user's profile either.
 *
 * Request body:
 * {
 *   blockedUserId: string
 * }
 *
 * Response:
 * {
 *   data: {
 *     success: boolean,
 *     message: string,
 *     blockedUserId: string
 *   }
 * }
 *
 * Status codes:
 * - 200: User successfully blocked
 * - 400: Invalid request (missing blockedUserId)
 * - 401: Unauthorized (not authenticated)
 * - 500: Internal server error
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    // Check authentication
    // In production, this would check the session/JWT token
    // For now, we'll assume authentication is handled by middleware

    // Parse request body
    const body = await request.json() as BlockUserRequest;

    // Validate input
    if (!body.blockedUserId) {
      return json(
        { error: 'blockedUserId is required' },
        { status: 400 }
      );
    }

    if (typeof body.blockedUserId !== 'string') {
      return json(
        { error: 'blockedUserId must be a string' },
        { status: 400 }
      );
    }

    // In production, this would:
    // 1. Get the current user ID from the session
    // 2. Create a block record in the database
    // 3. Remove the blocked user from the current user's discovery feed
    // 4. Remove the current user from the blocked user's discovery feed

    // Mock implementation
    const currentUserId = 'current-user-id'; // Would come from session
    const blockedUserId = body.blockedUserId;

    // Validate that user is not blocking themselves
    if (currentUserId === blockedUserId) {
      return json(
        { error: 'Cannot block yourself' },
        { status: 400 }
      );
    }

    // In production, save to database:
    // await db.blockedUsers.create({
    //   userId: currentUserId,
    //   blockedUserId: blockedUserId,
    //   createdAt: new Date()
    // });

    const response: BlockUserResponse = {
      data: {
        success: true,
        message: `User ${blockedUserId} has been blocked`,
        blockedUserId
      }
    };

    return json(response);
  } catch (error) {
    console.error('Block user error:', error);
    return json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
};
