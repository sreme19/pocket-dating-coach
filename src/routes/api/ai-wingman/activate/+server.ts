import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { activateAssistant } from '$lib/server/ai-assistant-manager';
import { loadPersonality } from '$lib/server/profile-service';
import {
	throwAuthenticationError,
	throwValidationError,
	throwDatabaseError,
	logError,
	ErrorType
} from '$lib/server/error-handler';
import type { UserProfile } from '$lib/types';

/**
 * POST /api/ai-wingman/activate
 * 
 * Activates AI Wingman for a specific match conversation.
 * 
 * Request body:
 * {
 *   "matchId": "string",
 *   "matchedUserProfile": {
 *     "gender": "woman",
 *     "ageRange": "23-28",
 *     "datingApp": "bumble",
 *     "relationshipGoal": "serious"
 *   }
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "conversationId": "uuid",
 *   "message": "AI Wingman activated. I'll help you craft authentic responses and navigate this conversation strategically."
 * }
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
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
		logError('POST /api/ai-wingman/activate', err, ErrorType.VALIDATION_ERROR);
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
		// Load user's personality to validate they exist
		// This will throw an error if personality cannot be loaded
		const personality = await loadPersonality(userId);

		// Validate that personality is not empty (user should have set up their profile)
		if (
			!personality ||
			(personality.communicationStyle.length === 0 &&
				personality.personalityVibe.length === 0 &&
				personality.values.length === 0 &&
				personality.datingPatterns.length === 0)
		) {
			logError(
				'POST /api/ai-wingman/activate',
				new Error('User personality is empty'),
				ErrorType.VALIDATION_ERROR,
				{ userId, matchId }
			);
			throwValidationError(
				'Your personality profile is incomplete. Please set up your personality before activating AI Wingman.'
			);
		}

		// Get user profile from session or locals
		// For now, we'll create a minimal profile from the session
		const userProfile: UserProfile = {
			gender: 'man',
			ageRange: 'unknown',
			datingApp: 'other',
			relationshipGoal: 'not_sure'
		};

		// Activate the assistant
		await activateAssistant(userId, matchId, 'wingman', userProfile, matchedUserProfile);

		// Log successful activation
		console.log(`[AI Wingman] Activated for user ${userId}, match ${matchId}`);

		return json({
			success: true,
			conversationId: `${userId}:${matchId}:wingman`,
			message:
				"AI Wingman activated. I'll help you craft authentic responses and navigate this conversation strategically."
		});
	} catch (err) {
		// Check if it's already an HTTP error
		if (err instanceof Error && 'status' in err) {
			throw err;
		}

		logError('POST /api/ai-wingman/activate', err, ErrorType.DATABASE_ERROR, {
			userId,
			matchId
		});

		throwDatabaseError(
			'POST /api/ai-wingman/activate',
			err,
			'Failed to activate AI Wingman. Please try again.'
		);
	}
};
