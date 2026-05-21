import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	canContinue,
	getExchangeCount,
	hasReachedExchangeLimit,
	getRemainingExchanges,
	getMaxExchangesPerSide
} from '$lib/server/ai-loop-prevention';
import { getSupabase } from '$lib/server/supabase';
import {
	throwAuthenticationError,
	throwValidationError,
	throwInternalError,
	validateRequiredFields,
	validateEnumValue,
	logError,
	ErrorType
} from '$lib/server/error-handler';

/**
 * Response type for the loop prevention check endpoint
 */
interface LoopPreventionCheckResponse {
	canContinue: boolean;
	exchangeCount: {
		bestieExchanges: number;
		wingmanExchanges: number;
		lastBestieExchange: number | null;
		lastWingmanExchange: number | null;
	};
	warnings: string[];
	remainingExchanges: {
		bestie: number;
		wingman: number;
	};
	maxExchangesPerSide: number;
}

/**
 * POST /api/ai-loop-prevention/check
 * 
 * Check if conversation can continue with AI assistants.
 * Validates user authentication and checks exchange limits.
 * 
 * Request body:
 * {
 *   "matchId": "string (match conversation ID)",
 *   "assistantType": "bestie" | "wingman" (optional, for specific assistant check)
 * }
 * 
 * Response:
 * {
 *   "canContinue": boolean,
 *   "exchangeCount": {
 *     "bestieExchanges": number,
 *     "wingmanExchanges": number,
 *     "lastBestieExchange": number | null,
 *     "lastWingmanExchange": number | null
 *   },
 *   "warnings": string[],
 *   "remainingExchanges": {
 *     "bestie": number,
 *     "wingman": number
 *   },
 *   "maxExchangesPerSide": number
 * }
 * 
 * Requirements: 11.1, 11.2, 11.3, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	// Validate user authentication
	const session = await locals.auth.getSession();
	if (!session?.user?.id) {
		throwAuthenticationError('User authentication required');
	}

	const userId = session.user.id;

	// Parse and validate request body
	let body: {
		matchId?: string;
		assistantType?: 'bestie' | 'wingman';
	};

	try {
		body = await request.json();
	} catch (err) {
		logError('Loop Prevention Check', err, ErrorType.VALIDATION_ERROR);
		throwValidationError('Invalid JSON in request body');
	}

	// Validate required parameters
	const { valid, missingFields } = validateRequiredFields(body, ['matchId']);

	if (!valid) {
		throwValidationError(`Missing required fields: ${missingFields.join(', ')}`);
	}

	const { matchId, assistantType } = body;

	// Validate matchId
	if (typeof matchId !== 'string' || matchId.trim().length === 0) {
		throwValidationError('matchId must be a non-empty string');
	}

	// Validate assistantType if provided
	if (assistantType) {
		const assistantTypeValidation = validateEnumValue(assistantType, ['bestie', 'wingman']);
		if (!assistantTypeValidation.valid) {
			throwValidationError(`Invalid assistantType: ${assistantTypeValidation.error}`);
		}
	}

	try {
		// Get current exchange counts
		const exchangeCount = await getExchangeCount(userId, matchId);

		// Determine if conversation can continue
		let canContinueResult = true;
		const warnings: string[] = [];

		// If a specific assistant type is provided, check if it can continue
		if (assistantType) {
			try {
				canContinueResult = await canContinue(userId, matchId, assistantType);

				// Check if limit has been reached
				const limitReached = await hasReachedExchangeLimit(userId, matchId, assistantType);
				if (limitReached) {
					warnings.push(
						`${assistantType === 'bestie' ? 'AI Bestie' : 'AI Wingman'} has reached the maximum of ${getMaxExchangesPerSide()} exchanges. User confirmation required to continue.`
					);
				}
			} catch (err) {
				logError('Loop Prevention Check', err, ErrorType.INTERNAL_ERROR, {
					context: 'Failed to check assistant continuation',
					assistantType
				});
				// Graceful fallback - allow continuation but warn user
				warnings.push('Unable to verify exchange limits. Proceeding with caution.');
			}
		} else {
			// If no specific assistant is provided, check both
			try {
				const bestieCanContinue = await canContinue(userId, matchId, 'bestie');
				const wingmanCanContinue = await canContinue(userId, matchId, 'wingman');

				// Can continue if at least one assistant can continue
				canContinueResult = bestieCanContinue || wingmanCanContinue;

				// Add warnings for assistants that have reached limits
				if (!bestieCanContinue) {
					warnings.push(
						`AI Bestie has reached the maximum of ${getMaxExchangesPerSide()} exchanges. User confirmation required to continue.`
					);
				}

				if (!wingmanCanContinue) {
					warnings.push(
						`AI Wingman has reached the maximum of ${getMaxExchangesPerSide()} exchanges. User confirmation required to continue.`
					);
				}
			} catch (err) {
				logError('Loop Prevention Check', err, ErrorType.INTERNAL_ERROR, {
					context: 'Failed to check both assistants'
				});
				// Graceful fallback - allow continuation but warn user
				warnings.push('Unable to verify exchange limits. Proceeding with caution.');
			}
		}

		// Get remaining exchanges for both assistants
		let bestieRemaining = getMaxExchangesPerSide();
		let wingmanRemaining = getMaxExchangesPerSide();

		try {
			bestieRemaining = await getRemainingExchanges(userId, matchId, 'bestie');
			wingmanRemaining = await getRemainingExchanges(userId, matchId, 'wingman');
		} catch (err) {
			logError('Loop Prevention Check', err, ErrorType.INTERNAL_ERROR, {
				context: 'Failed to get remaining exchanges'
			});
			// Use defaults on error
		}

		// Add warning if approaching limit (within 2 exchanges)
		if (bestieRemaining > 0 && bestieRemaining <= 2) {
			warnings.push(
				`AI Bestie is approaching the exchange limit (${bestieRemaining} remaining).`
			);
		}

		if (wingmanRemaining > 0 && wingmanRemaining <= 2) {
			warnings.push(
				`AI Wingman is approaching the exchange limit (${wingmanRemaining} remaining).`
			);
		}

		const response: LoopPreventionCheckResponse = {
			canContinue: canContinueResult,
			exchangeCount,
			warnings,
			remainingExchanges: {
				bestie: bestieRemaining,
				wingman: wingmanRemaining
			},
			maxExchangesPerSide: getMaxExchangesPerSide()
		};

		return json(response);
	} catch (err) {
		// If error is already a SvelteKit error, re-throw it
		if (err instanceof Error && err.message.includes('SvelteKit')) {
			throw err;
		}

		logError('Loop Prevention Check', err, ErrorType.INTERNAL_ERROR);

		// Return a safe default response on error to avoid blocking the user
		const response: LoopPreventionCheckResponse = {
			canContinue: true,
			exchangeCount: {
				bestieExchanges: 0,
				wingmanExchanges: 0,
				lastBestieExchange: null,
				lastWingmanExchange: null
			},
			warnings: ['Unable to verify exchange limits. Proceeding with caution.'],
			remainingExchanges: {
				bestie: getMaxExchangesPerSide(),
				wingman: getMaxExchangesPerSide()
			},
			maxExchangesPerSide: getMaxExchangesPerSide()
		};

		return json(response, { status: 200 });
	}
};
