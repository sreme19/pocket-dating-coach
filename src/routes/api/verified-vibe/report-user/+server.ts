import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { ReportReason } from '$lib/verified-vibe/types';

interface ReportUserRequest {
  reportedUserId: string;
  reason: ReportReason;
  description?: string;
}

interface ReportUserResponse {
  data: {
    success: boolean;
    message: string;
    reportId: string;
  };
}

/**
 * POST /api/verified-vibe/report-user
 *
 * Reports a user for inappropriate behavior or content.
 * Reports are sent to the moderation team for review.
 *
 * Request body:
 * {
 *   reportedUserId: string,
 *   reason: 'inappropriate_content' | 'harassment' | 'fake_profile' | 'scam' | 'other',
 *   description?: string
 * }
 *
 * Response:
 * {
 *   data: {
 *     success: boolean,
 *     message: string,
 *     reportId: string
 *   }
 * }
 *
 * Status codes:
 * - 200: Report successfully submitted
 * - 400: Invalid request (missing fields or invalid reason)
 * - 401: Unauthorized (not authenticated)
 * - 500: Internal server error
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    // Check authentication
    // In production, this would check the session/JWT token
    // For now, we'll assume authentication is handled by middleware

    // Parse request body
    const body = await request.json() as ReportUserRequest;

    // Validate input
    if (!body.reportedUserId) {
      return json(
        { error: 'reportedUserId is required' },
        { status: 400 }
      );
    }

    if (!body.reason) {
      return json(
        { error: 'reason is required' },
        { status: 400 }
      );
    }

    // Validate reason
    const validReasons: ReportReason[] = [
      'inappropriate_content',
      'harassment',
      'fake_profile',
      'scam',
      'other'
    ];

    if (!validReasons.includes(body.reason)) {
      return json(
        { error: `reason must be one of: ${validReasons.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate description if provided
    if (body.description && typeof body.description !== 'string') {
      return json(
        { error: 'description must be a string' },
        { status: 400 }
      );
    }

    if (body.description && body.description.length > 1000) {
      return json(
        { error: 'description must be less than 1000 characters' },
        { status: 400 }
      );
    }

    // In production, this would:
    // 1. Get the current user ID from the session
    // 2. Create a report record in the database
    // 3. Send notification to moderation team
    // 4. Optionally block the user automatically if multiple reports

    // Mock implementation
    const currentUserId = 'current-user-id'; // Would come from session
    const reportedUserId = body.reportedUserId;
    const reportId = `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Validate that user is not reporting themselves
    if (currentUserId === reportedUserId) {
      return json(
        { error: 'Cannot report yourself' },
        { status: 400 }
      );
    }

    // In production, save to database:
    // const report = await db.reports.create({
    //   userId: currentUserId,
    //   reportedUserId: reportedUserId,
    //   reason: body.reason,
    //   description: body.description || '',
    //   status: 'pending',
    //   createdAt: new Date()
    // });

    // In production, send notification to moderation team:
    // await sendModerationNotification({
    //   reportId: report.id,
    //   reportedUserId: reportedUserId,
    //   reason: body.reason,
    //   description: body.description,
    //   reportedBy: currentUserId
    // });

    const response: ReportUserResponse = {
      data: {
        success: true,
        message: 'Report submitted successfully. Our moderation team will review it shortly.',
        reportId
      }
    };

    return json(response);
  } catch (error) {
    console.error('Report user error:', error);
    return json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
};
