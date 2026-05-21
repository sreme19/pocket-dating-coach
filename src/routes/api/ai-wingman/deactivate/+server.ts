import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deactivateAssistant } from '$lib/server/ai-assistant-manager';
import {
	throwAuthenticationError,
	throwValidationError,
	throwDatabaseError,
	logError,
	ErrorType
} from '$lib/server/error-handler';

/**
 * POST /api/ai-wingman/deactivate
 * 
 * Deactivates AI Wingman for a specific match conversation.
 * Clears cached profile data and returns to regular chat mode.
 * 
 * Request body:
 * {
 *   "matchId": "string"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "AI Wingman deactivated. You can reactivate it anytime."
 * }
 * 
 * Requirements: 20.1, 20.2, 20.3
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	// Validate authentication
	const session = await locals.auth.getSession();
	if (!session?.user?.id) {
		throwAuthenticationError('User authentication required');
	}

	const userId = session.user.id;

	// Parse and validate request body
	let body: {
		matchId: string;
	};

	try {
		body = await request.json();
	} catch (err) {
		logError('POST /api/ai-wingman/deactivate', err, ErrorType.VALIDATION_ERROR);
		throwValidationError('Invalid JSON in request body');
	}

	// Validate required fields
	if (!body.matchId || typeof body.matchId !== 'string') {
		throwValidationError('matchId is required and must be a string');
	}

	// Validate matchId format (should be non-empty string)
	if (body.matchId.trim().length === 0) {
		throwValidationError('matchId cannot be empty');
	}

	const matchId = body.matchId.trim();

	try {
		// Deactivate the assistant
		await deactivateAssistant(userId, matchId, 'wingman');

		// Log successful deactivation
		console.log(`[AI Wingman] Deactivated for user ${userId}, match ${matchId}`);

		return json({
			success: true,
			message: 'AI Wingman deactivated. You can reactivate it anytime.'
		});
	} catch (err) {
		// Check if it's already an HTTP error
		if (err instanceof Error && 'status' in err) {
			throw err;
		}

		logError('POST /api/ai-wingman/deactivate', err, ErrorType.DATABASE_ERROR, {
			userId,
			matchId
		});

		throwDatabaseError(
			'POST /api/ai-wingman/deactivate',
			err,
			'Failed to deactivate AI Wingman. Please try again.'
		);
	}
};
