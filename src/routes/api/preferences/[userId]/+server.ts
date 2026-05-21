import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
import {
	loadPreferences,
	updatePreferences,
	getPreferencesHistory,
	restoreProfileVersion,
	type PreferencesProfile
} from '$lib/server/profile-service';
import {
	throwAuthenticationError,
	throwValidationError,
	throwDatabaseError,
	throwInternalError,
	validateRequiredFields,
	validateFieldTypes,
	logError,
	ErrorType
} from '$lib/server/error-handler';

/**
 * GET /api/preferences/:userId
 * Retrieve a specific user's preferences.md profile
 * 
 * Requirements: 8.1, 12.1, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	// Validate authentication
	const session = await locals.auth.getSession();
	if (!session?.user?.id) {
		throwAuthenticationError('User authentication required');
	}

	const userId = params.userId;

	// Validate userId parameter
	if (!userId || typeof userId !== 'string') {
		throwValidationError('userId parameter is required');
	}

	// Users can only access their own preferences (unless they're an admin)
	if (session.user.id !== userId) {
		throwAuthenticationError('You can only access your own preferences');
	}

	try {
		const preferences = await loadPreferences(userId);

		return json({
			success: true,
			data: preferences
		});
	} catch (err) {
		logError('GET /api/preferences/:userId', err, ErrorType.DATABASE_ERROR, {
			userId
		});

		// Return default preferences on error (graceful fallback)
		const defaultPreferences: PreferencesProfile = {
			emotionalSignals: [],
			lifestyleSignals: [],
			maturitySignals: [],
			boundaries: [],
			dealbreakers: [],
			privateCompatibilityNotes: [],
			updatedAt: Date.now()
		};

		return json({
			success: true,
			data: defaultPreferences,
			warning: 'Could not load your profile data. Using default values.'
		});
	}
};

/**
 * POST /api/preferences/:userId
 * Update a specific user's preferences.md profile with version tracking
 * 
 * Request body:
 * {
 *   "updates": { ... partial PreferencesProfile },
 *   "reason": "string describing why this update was made"
 * }
 * 
 * Requirements: 8.1, 12.1, 12.2, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	// Validate authentication
	const session = await locals.auth.getSession();
	if (!session?.user?.id) {
		throwAuthenticationError('User authentication required');
	}

	const userId = params.userId;

	// Validate userId parameter
	if (!userId || typeof userId !== 'string') {
		throwValidationError('userId parameter is required');
	}

	// Users can only update their own preferences
	if (session.user.id !== userId) {
		throwAuthenticationError('You can only update your own preferences');
	}

	// Parse and validate request body
	let body: { updates: Partial<PreferencesProfile>; reason?: string };

	try {
		body = await request.json();
	} catch (err) {
		logError('POST /api/preferences/:userId', err, ErrorType.VALIDATION_ERROR);
		throwValidationError('Invalid JSON in request body');
	}

	// Validate required fields
	if (!body.updates || typeof body.updates !== 'object') {
		throwValidationError('updates field is required and must be an object');
	}

	// Validate updates object structure
	const validFields = [
		'emotionalSignals',
		'lifestyleSignals',
		'maturitySignals',
		'boundaries',
		'dealbreakers',
		'privateCompatibilityNotes'
	];

	for (const key of Object.keys(body.updates)) {
		if (!validFields.includes(key)) {
			throwValidationError(`Invalid field in updates: ${key}`);
		}
	}

	// Validate field types
	const typeMap: Record<string, string> = {};
	if ('emotionalSignals' in body.updates) typeMap['emotionalSignals'] = 'object';
	if ('lifestyleSignals' in body.updates) typeMap['lifestyleSignals'] = 'object';
	if ('maturitySignals' in body.updates) typeMap['maturitySignals'] = 'object';
	if ('boundaries' in body.updates) typeMap['boundaries'] = 'object';
	if ('dealbreakers' in body.updates) typeMap['dealbreakers'] = 'object';
	if ('privateCompatibilityNotes' in body.updates) typeMap['privateCompatibilityNotes'] = 'object';

	const typeValidation = validateFieldTypes(body.updates, typeMap);
	if (!typeValidation.valid) {
		const invalidFieldsStr = typeValidation.invalidFields
			.map(f => `${f.field} (expected ${f.expected}, got ${f.actual})`)
			.join(', ');
		throwValidationError(`Invalid field types: ${invalidFieldsStr}`);
	}

	const reason = body.reason || 'Profile updated';

	// Validate reason length
	if (typeof reason !== 'string' || reason.length > 500) {
		throwValidationError('reason must be a string with max 500 characters');
	}

	try {
		// Update preferences with version tracking
		await updatePreferences(userId, body.updates, reason);

		// Load the updated preferences to return
		const updatedPreferences = await loadPreferences(userId);

		// Get version history to return the new version number
		const history = await getPreferencesHistory(userId);
		const latestVersion = history.length > 0 ? history[0].version : 1;

		return json({
			success: true,
			data: updatedPreferences,
			version: latestVersion,
			updatedAt: Date.now()
		});
	} catch (err) {
		logError('POST /api/preferences/:userId', err, ErrorType.DATABASE_ERROR, {
			userId,
			reason
		});

		throwDatabaseError('POST /api/preferences/:userId', err, 'Failed to update preferences profile');
	}
};
