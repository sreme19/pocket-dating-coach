import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { activateAssistant } from '$lib/server/ai-assistant-manager';
import { loadPreferences } from '$lib/server/profile-service';
import {
	throwAuthenticationError,
	throwValidationError,
	throwDatabaseError,
	logError,
	ErrorType
} from '$lib/server/error-handler';
import type { UserProfile } from '$lib/types';

/**
 * POST /api/ai-bestie/activate
 * 
 * Activates AI Bestie for a specific match conversation.
 * 
 * Request body:
 * {
 *   "matchId": "string",
 *   "matchedUserProfile": {
 *     "gender": "man",
 *     "ageRange": "25-30",
 *     "datingApp": "hinge",
 *     "relationshipGoal": "serious"
 *   }
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "conversationId": "uuid",
 *   "message": "AI Bestie activated. I'll help you navigate this conversation with strategic advice and compatibility insights."
 * }
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 5.1, 5.2, 6.1, 6.2
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
		matchedUserProfile?: Partial<UserProfile>;
	};

	try {
		body = await request.json();
	} catch (err) {
		logError('POST /api/ai-bestie/activate', err, ErrorType.VALIDATION_ERROR);
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

	// Validate matchedUserProfile if provided
	if (body.matchedUserProfile) {
		if (typeof body.matchedUserProfile !== 'object') {
			throwValidationError('matchedUserProfile must be an object');
		}

		// Validate matchedUserProfile fields
		const validFields = ['gender', 'ageRange', 'datingApp', 'relationshipGoal'];
		for (const key of Object.keys(body.matchedUserProfile)) {
			if (!validFields.includes(key)) {
				throwValidationError(`Invalid field in matchedUserProfile: ${key}`);
			}
		}
	}

	const matchId = body.matchId.trim();
	const matchedUserProfile = body.matchedUserProfile;

	try {
		// Load user's preferences to validate they exist
		// This will throw an error if preferences cannot be loaded
		const preferences = await loadPreferences(userId);

		// Validate that preferences are not empty (user should have set up their profile)
		if (
			!preferences ||
			(preferences.emotionalSignals.length === 0 &&
				preferences.lifestyleSignals.length === 0 &&
				preferences.boundaries.length === 0 &&
				preferences.dealbreakers.length === 0)
		) {
			logError(
				'POST /api/ai-bestie/activate',
				new Error('User preferences are empty'),
				ErrorType.VALIDATION_ERROR,
				{ userId, matchId }
			);
			throwValidationError(
				'Your preferences profile is incomplete. Please set up your preferences before activating AI Bestie.'
			);
		}

		// Get user profile from session or locals
		// For now, we'll create a minimal profile from the session
		const userProfile: UserProfile = {
			gender: 'woman',
			ageRange: 'unknown',
			datingApp: 'other',
			relationshipGoal: 'not_sure'
		};

		// Activate the assistant
		await activateAssistant(userId, matchId, 'bestie', userProfile, matchedUserProfile);

		// Log successful activation
		console.log(`[AI Bestie] Activated for user ${userId}, match ${matchId}`);

		return json({
			success: true,
			conversationId: `${userId}:${matchId}:bestie`,
			message:
				"AI Bestie activated. I'll help you navigate this conversation with strategic advice and compatibility insights."
		});
	} catch (err) {
		// Check if it's already an HTTP error
		if (err instanceof Error && 'status' in err) {
			throw err;
		}

		logError('POST /api/ai-bestie/activate', err, ErrorType.DATABASE_ERROR, {
			userId,
			matchId
		});

		throwDatabaseError(
			'POST /api/ai-bestie/activate',
			err,
			'Failed to activate AI Bestie. Please try again.'
		);
	}
};
