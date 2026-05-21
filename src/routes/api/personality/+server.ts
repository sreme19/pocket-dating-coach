import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
import {
	loadPersonality,
	updatePersonality,
	getPersonalityHistory,
	restoreProfileVersion,
	type PersonalityProfile
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
 * GET /api/personality
 * Retrieve user's personality.md profile
 * 
 * Requirements: 8.1, 12.1, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */
export const GET: RequestHandler = async ({ locals }) => {
	// Validate authentication
	const session = await locals.auth.getSession();
	if (!session?.user?.id) {
		throwAuthenticationError('User authentication required');
	}

	const userId = session.user.id;

	try {
		const personality = await loadPersonality(userId);

		return json({
			success: true,
			data: personality
		});
	} catch (err) {
		logError('GET /api/personality', err, ErrorType.DATABASE_ERROR, {
			userId
		});

		// Return default personality on error (graceful fallback)
		const defaultPersonality: PersonalityProfile = {
			communicationStyle: '',
			personalityVibe: '',
			mattersMost: '',
			values: [],
			datingPatterns: [],
			redFlagsToAvoid: [],
			updatedAt: Date.now()
		};

		return json({
			success: true,
			data: defaultPersonality,
			warning: 'Could not load your profile data. Using default values.'
		});
	}
};

/**
 * POST /api/personality
 * Update user's personality.md profile with version tracking
 * 
 * Request body:
 * {
 *   "updates": { ... partial PersonalityProfile },
 *   "reason": "string describing why this update was made"
 * }
 * 
 * Requirements: 8.1, 12.1, 12.2, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	// Validate authentication
	const session = await locals.auth.getSession();
	if (!session?.user?.id) {
		throwAuthenticationError('User authentication required');
	}

	const userId = session.user.id;

	// Parse and validate request body
	let body: { updates: Partial<PersonalityProfile>; reason?: string };

	try {
		body = await request.json();
	} catch (err) {
		logError('POST /api/personality', err, ErrorType.VALIDATION_ERROR);
		throwValidationError('Invalid JSON in request body');
	}

	// Validate required fields
	if (!body.updates || typeof body.updates !== 'object') {
		throwValidationError('updates field is required and must be an object');
	}

	// Validate updates object structure
	const validFields = [
		'communicationStyle',
		'personalityVibe',
		'mattersMost',
		'values',
		'datingPatterns',
		'redFlagsToAvoid'
	];

	for (const key of Object.keys(body.updates)) {
		if (!validFields.includes(key)) {
			throwValidationError(`Invalid field in updates: ${key}`);
		}
	}

	// Validate field types
	const typeMap: Record<string, string> = {};
	if ('values' in body.updates) typeMap['values'] = 'object'; // array is typeof 'object'
	if ('datingPatterns' in body.updates) typeMap['datingPatterns'] = 'object';
	if ('redFlagsToAvoid' in body.updates) typeMap['redFlagsToAvoid'] = 'object';

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
		// Update personality with version tracking
		await updatePersonality(userId, body.updates, reason);

		// Load the updated personality to return
		const updatedPersonality = await loadPersonality(userId);

		// Get version history to return the new version number
		const history = await getPersonalityHistory(userId);
		const latestVersion = history.length > 0 ? history[0].version : 1;

		return json({
			success: true,
			data: updatedPersonality,
			version: latestVersion,
			updatedAt: Date.now()
		});
	} catch (err) {
		logError('POST /api/personality', err, ErrorType.DATABASE_ERROR, {
			userId,
			reason
		});

		throwDatabaseError('POST /api/personality', err, 'Failed to update personality profile');
	}
};
