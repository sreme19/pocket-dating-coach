import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getClaudeClient, CLAUDE_MODEL, MAX_TOKENS } from '$lib/claude';
import { searchBookChunks } from '$lib/vectorstore';
import { getEmbedding } from '$lib/embeddings';
import {
	buildAIWingmanSystemPrompt,
	buildAIAssistantContextPrompt
} from '$lib/prompts';
import type { UserProfile, ChatMessage } from '$lib/types';
import {
	throwAuthenticationError,
	throwValidationError,
	throwExternalAPIError,
	throwInternalError,
	throwDatabaseError,
	validateRequiredFields,
	logError,
	ErrorType,
	validateClaudeResponse
} from '$lib/server/error-handler';
import { loadPersonality } from '$lib/server/profile-service';
import { getSupabase } from '$lib/server/supabase';
import { generateResponseOptions } from '$lib/server/ai-assistant-service';

/**
 * POST /api/ai-wingman/impersonate
 * 
 * Generate impersonation response options for AI Wingman.
 * This endpoint generates 2-3 response options that the user can review and send.
 * 
 * Request body:
 * {
 *   "conversationId": "uuid",
 *   "matchLastMessage": "I'm really into hiking and travel. What about you?",
 *   "recentMessages": [
 *     { "role": "user", "content": "..." },
 *     { "role": "assistant", "content": "..." }
 *   ],
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
 *   "options": [
 *     {
 *       "id": "option-0",
 *       "tone": "playful",
 *       "message": "That sounds amazing! I've been wanting to get back into hiking...",
 *       "why": "Shows genuine interest and vulnerability",
 *       "citation": "Based on: Chapter 2 - Authentic Communication"
 *     },
 *     ...
 *   ],
 *   "message": "Here are 3 response options you can review and send:"
 * }
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
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
		conversationId: string;
		matchLastMessage: string;
		recentMessages?: ChatMessage[];
		matchedUserProfile?: Partial<UserProfile>;
	};

	try {
		body = await request.json();
	} catch (err) {
		logError('POST /api/ai-wingman/impersonate', err, ErrorType.VALIDATION_ERROR);
		throwValidationError('Invalid JSON in request body');
	}

	// Validate required fields
	const { valid, missingFields } = validateRequiredFields(body, [
		'conversationId',
		'matchLastMessage'
	]);

	if (!valid) {
		throwValidationError(`Missing required fields: ${missingFields.join(', ')}`);
	}

	const { conversationId, matchLastMessage, recentMessages = [], matchedUserProfile } = body;

	// Validate conversationId is non-empty string
	if (typeof conversationId !== 'string' || conversationId.trim().length === 0) {
		throwValidationError('conversationId must be a non-empty string');
	}

	// Validate matchLastMessage is non-empty string
	if (typeof matchLastMessage !== 'string' || matchLastMessage.trim().length === 0) {
		throwValidationError('matchLastMessage must be a non-empty string');
	}

	// Validate recentMessages is an array
	if (!Array.isArray(recentMessages)) {
		throwValidationError('recentMessages must be an array');
	}

	// Validate each message in recentMessages
	for (let i = 0; i < recentMessages.length; i++) {
		const msg = recentMessages[i];
		if (!msg.role || !msg.content) {
			throwValidationError(`Message at index ${i} missing required fields: role, content`);
		}
		if (typeof msg.content !== 'string' || msg.content.trim().length === 0) {
			throwValidationError(`Message at index ${i} content must be a non-empty string`);
		}
	}

	// Validate matchedUserProfile if provided
	if (matchedUserProfile) {
		if (typeof matchedUserProfile !== 'object') {
			throwValidationError('matchedUserProfile must be an object');
		}

		const validFields = ['gender', 'ageRange', 'datingApp', 'relationshipGoal'];
		for (const key of Object.keys(matchedUserProfile)) {
			if (!validFields.includes(key)) {
				throwValidationError(`Invalid field in matchedUserProfile: ${key}`);
			}
		}
	}

	// Check if there are at least 20 messages from the match
	const matchMessageCount = recentMessages.filter(msg => msg.role === 'assistant').length;
	if (matchMessageCount < 20) {
		logError(
			'POST /api/ai-wingman/impersonate',
			new Error('Insufficient messages from match'),
			ErrorType.VALIDATION_ERROR,
			{ userId, conversationId, matchMessageCount }
		);
		throwValidationError(
			`Impersonation mode is available after 20+ messages from the match. You currently have ${matchMessageCount} messages.`
		);
	}

	try {
		// Load user's personality
		let personality;
		try {
			personality = await loadPersonality(userId);
		} catch (err) {
			logError('POST /api/ai-wingman/impersonate', err, ErrorType.DATABASE_ERROR, {
				context: 'Failed to load personality',
				userId
			});
			throwValidationError(
				'Could not load your personality profile. Please ensure your profile is set up.'
			);
		}

		// Get the last user message for embedding search
		const lastUserMessage = matchLastMessage.trim();

		// Search for relevant book chunks with error handling
		let bookContext = '';
		try {
			const queryEmbedding = await getEmbedding(lastUserMessage);
			if (!queryEmbedding) {
				logError('POST /api/ai-wingman/impersonate', new Error('No embedding returned'), ErrorType.EXTERNAL_API_ERROR);
			} else {
				const chunks = await searchBookChunks(queryEmbedding, 5);
				bookContext = chunks.map(c => `[${c.chapter}]\n${c.content}`).join('\n\n---\n\n');
			}
		} catch (err) {
			logError('POST /api/ai-wingman/impersonate', err, ErrorType.EXTERNAL_API_ERROR, {
				context: 'Failed to search book chunks'
			});
			// Continue without book context - graceful fallback
			bookContext = 'No book context available.';
		}

		// Create a minimal user profile for the system prompt
		const userProfile: UserProfile = {
			gender: 'man',
			ageRange: 'unknown',
			datingApp: 'other',
			relationshipGoal: 'not_sure'
		};

		// Generate response options using AI Assistant Service
		let options;
		try {
			options = await generateResponseOptions(
				'wingman',
				lastUserMessage,
				recentMessages,
				userProfile,
				{ matchedUserProfile, recentMessages },
				bookContext || 'No book context available.',
				personality
			);
		} catch (err) {
			logError('POST /api/ai-wingman/impersonate', err, ErrorType.EXTERNAL_API_ERROR, {
				context: 'Failed to generate response options'
			});
			throwExternalAPIError(
				'POST /api/ai-wingman/impersonate',
				err,
				'Sorry, I couldn\'t generate response options. Please try again.'
			);
		}

		// Validate that we got options
		if (!options || options.length === 0) {
			logError(
				'POST /api/ai-wingman/impersonate',
				new Error('No response options generated'),
				ErrorType.EXTERNAL_API_ERROR
			);
			throwExternalAPIError(
				'POST /api/ai-wingman/impersonate',
				new Error('No options generated'),
				'Failed to generate response options. Please try again.'
			);
		}

		// Update conversation config to enable impersonation mode
		try {
			const supabase = getSupabase();

			// Update the conversation to mark impersonation as enabled
			const { error: updateError } = await supabase
				.from('ai_assistant_conversations')
				.update({
					impersonation_enabled: true,
					updated_at: new Date().toISOString()
				} as any)
				.eq('id', conversationId)
				.eq('user_id', userId);

			if (updateError) {
				logError('POST /api/ai-wingman/impersonate', updateError, ErrorType.DATABASE_ERROR, {
					context: 'Failed to update conversation config',
					userId,
					conversationId
				});
				// Don't throw - we still want to return the options to the user
			}
		} catch (err) {
			logError('POST /api/ai-wingman/impersonate', err, ErrorType.DATABASE_ERROR, {
				context: 'Failed to update conversation config',
				userId,
				conversationId
			});
			// Don't throw - we still want to return the options to the user
		}

		return json({
			options,
			message: 'Here are 3 response options you can review and send:'
		});
	} catch (err) {
		// If error is already a SvelteKit error, re-throw it
		if (err instanceof Error && 'status' in err) {
			throw err;
		}

		// Log unexpected errors
		logError('POST /api/ai-wingman/impersonate', err, ErrorType.INTERNAL_ERROR);
		throwInternalError('POST /api/ai-wingman/impersonate', err, 'Failed to generate impersonation options');
	}
};
