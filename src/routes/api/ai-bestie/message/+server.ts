import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getClaudeClient, CLAUDE_MODEL, MAX_TOKENS } from '$lib/claude';
import { searchBookChunks } from '$lib/vectorstore';
import { getEmbedding } from '$lib/embeddings';
import {
	buildAIBestieSystemPrompt,
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
	validateArrayLength,
	logError,
	ErrorType,
	validateClaudeResponse
} from '$lib/server/error-handler';
import { loadPreferences } from '$lib/server/profile-service';
import { getSupabase } from '$lib/server/supabase';
import { autoUpdateProfile } from '$lib/server/ai-assistant-service';

/**
 * POST /api/ai-bestie/message
 * 
 * Send a message to AI Bestie and receive advice.
 * 
 * Request body:
 * {
 *   "conversationId": "uuid",
 *   "userMessage": "He just asked me out for coffee. Should I say yes?",
 *   "recentMessages": [
 *     { "role": "user", "content": "..." },
 *     { "role": "assistant", "content": "..." }
 *   ],
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
 *   "reply": "Coffee is a great low-pressure first date!...",
 *   "citations": ["Based on: Chapter 3 - Reading Interest Signals"],
 *   "suggestions": ["Say yes with enthusiasm", "Suggest a specific time"]
 * }
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.1, 5.2, 6.1, 6.2
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
		userMessage: string;
		recentMessages?: ChatMessage[];
		matchedUserProfile?: Partial<UserProfile>;
	};

	try {
		body = await request.json();
	} catch (err) {
		logError('POST /api/ai-bestie/message', err, ErrorType.VALIDATION_ERROR);
		throwValidationError('Invalid JSON in request body');
	}

	// Validate required fields
	const { valid, missingFields } = validateRequiredFields(body, ['conversationId', 'userMessage']);

	if (!valid) {
		throwValidationError(`Missing required fields: ${missingFields.join(', ')}`);
	}

	const { conversationId, userMessage, recentMessages = [], matchedUserProfile } = body;

	// Validate conversationId is non-empty string
	if (typeof conversationId !== 'string' || conversationId.trim().length === 0) {
		throwValidationError('conversationId must be a non-empty string');
	}

	// Validate userMessage is non-empty string
	if (typeof userMessage !== 'string' || userMessage.trim().length === 0) {
		throwValidationError('userMessage must be a non-empty string');
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

	try {
		// Load user's preferences
		let preferences;
		try {
			preferences = await loadPreferences(userId);
		} catch (err) {
			logError('POST /api/ai-bestie/message', err, ErrorType.DATABASE_ERROR, {
				context: 'Failed to load preferences',
				userId
			});
			throwValidationError(
				'Could not load your preferences. Please ensure your profile is set up.'
			);
		}

		// Get the last user message for embedding search
		const lastUserMessage = userMessage.trim();

		// Search for relevant book chunks with error handling
		let bookContext = '';
		try {
			const queryEmbedding = await getEmbedding(lastUserMessage);
			if (!queryEmbedding) {
				logError('POST /api/ai-bestie/message', new Error('No embedding returned'), ErrorType.EXTERNAL_API_ERROR);
			} else {
				const chunks = await searchBookChunks(queryEmbedding, 5);
				bookContext = chunks.map(c => `[${c.chapter}]\n${c.content}`).join('\n\n---\n\n');
			}
		} catch (err) {
			logError('POST /api/ai-bestie/message', err, ErrorType.EXTERNAL_API_ERROR, {
				context: 'Failed to search book chunks'
			});
			// Continue without book context - graceful fallback
			bookContext = 'No book context available.';
		}

		// Build system prompt for AI Bestie
		let systemPrompt: string;
		try {
			// Create a minimal user profile for the system prompt
			const userProfile: UserProfile = {
				gender: 'woman',
				ageRange: 'unknown',
				datingApp: 'other',
				relationshipGoal: 'not_sure'
			};

			systemPrompt = buildAIBestieSystemPrompt(
				userProfile,
				bookContext || 'No book context available.',
				matchedUserProfile,
				preferences
			);
		} catch (err) {
			logError('POST /api/ai-bestie/message', err, ErrorType.INTERNAL_ERROR, {
				context: 'Failed to build system prompt'
			});
			throwInternalError('POST /api/ai-bestie/message', err, 'Failed to prepare AI Bestie context');
		}

		// Add context about recent messages if provided
		if (recentMessages && Array.isArray(recentMessages) && recentMessages.length > 0) {
			try {
				const recentMessagesText = recentMessages
					.slice(-5)
					.map(m => `${m.role === 'user' ? 'You' : 'Match'}: ${m.content}`)
					.join('\n');

				const matchedUserInfo = matchedUserProfile
					? `Gender: ${matchedUserProfile.gender || 'unknown'}, Age: ${matchedUserProfile.ageRange || 'unknown'}, Goal: ${matchedUserProfile.relationshipGoal || 'unknown'}`
					: 'No profile info available';

				const contextPrompt = buildAIAssistantContextPrompt(
					'bestie',
					recentMessagesText,
					matchedUserInfo
				);

				systemPrompt += '\n\n' + contextPrompt;
			} catch (err) {
				logError('POST /api/ai-bestie/message', err, ErrorType.INTERNAL_ERROR, {
					context: 'Failed to add match context'
				});
				// Continue without match context - graceful fallback
			}
		}

		// Call Claude API with error handling
		let response;
		try {
			const client = getClaudeClient();
			response = await client.messages.create({
				model: CLAUDE_MODEL,
				max_tokens: MAX_TOKENS,
				system: systemPrompt,
				messages: [
					{
						role: 'user',
						content: userMessage
					}
				]
			});
		} catch (err) {
			logError('POST /api/ai-bestie/message', err, ErrorType.EXTERNAL_API_ERROR, {
				context: 'Claude API call failed'
			});
			throwExternalAPIError(
				'POST /api/ai-bestie/message',
				err,
				'Sorry, I couldn\'t generate a response. Please try again.'
			);
		}

		// Validate Claude response
		const responseValidation = validateClaudeResponse(response);
		if (!responseValidation.valid) {
			logError('POST /api/ai-bestie/message', new Error(responseValidation.error), ErrorType.EXTERNAL_API_ERROR);
			throwExternalAPIError(
				'POST /api/ai-bestie/message',
				new Error(responseValidation.error),
				'Unexpected response format from AI service'
			);
		}

		const block = response.content[0];
		if (block.type !== 'text') {
			logError('POST /api/ai-bestie/message', new Error('Unexpected response type'), ErrorType.EXTERNAL_API_ERROR, {
				blockType: block.type
			});
			throwExternalAPIError(
				'POST /api/ai-bestie/message',
				new Error('Unexpected response type'),
				'Invalid response from AI service'
			);
		}

		const fullText = block.text;

		// Validate response text
		if (!fullText || typeof fullText !== 'string') {
			logError('POST /api/ai-bestie/message', new Error('Empty response text'), ErrorType.EXTERNAL_API_ERROR);
			throwExternalAPIError(
				'POST /api/ai-bestie/message',
				new Error('Empty response'),
				'AI service returned empty response'
			);
		}

		// Extract citations
		const citationMatches = [...fullText.matchAll(/\*Based on:([^*]+)\*/g)].map(
			m => `Based on:${m[1].trim()}`
		);

		// Remove citations from the main text and clean up extra spaces
		const cleanText = fullText.replace(/\*Based on:[^*]+\*/g, '').replace(/\s+/g, ' ').trim();

		// Extract suggestions (lines starting with - or •)
		const suggestions = cleanText
			.split('\n')
			.filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
			.map(line => line.trim().replace(/^[-•]\s*/, ''))
			.filter(s => s.length > 0);

		// Save message to database
		try {
			const supabase = getSupabase();

			// Get or create conversation record
			const { data: existingConversation, error: fetchError } = await supabase
				.from('ai_assistant_conversations')
				.select('id, messages')
				.eq('user_id', userId)
				.eq('id', conversationId)
				.single();

			if (fetchError && fetchError.code !== 'PGRST116') {
				// PGRST116 means no rows found, which is expected for new conversations
				throw new Error(`Failed to fetch conversation: ${fetchError.message}`);
			}

			// Prepare message objects
			const userMessageObj: ChatMessage = {
				role: 'user',
				content: userMessage
			};

			const assistantMessageObj: ChatMessage = {
				role: 'assistant',
				content: cleanText,
				assistantType: 'bestie'
			};

			// Combine with existing messages or create new array
			const existingMessages = existingConversation?.messages || [];
			const updatedMessages = [...existingMessages, userMessageObj, assistantMessageObj];

			// Upsert conversation
			const { error: upsertError } = await supabase
				.from('ai_assistant_conversations')
				.upsert(
					{
						id: conversationId,
						user_id: userId,
						match_conversation_id: conversationId,
						assistant_type: 'bestie',
						messages: updatedMessages,
						is_active: true,
						updated_at: new Date().toISOString()
					},
					{ onConflict: 'id' }
				);

			if (upsertError) {
				logError('POST /api/ai-bestie/message', upsertError, ErrorType.DATABASE_ERROR, {
					context: 'Failed to save conversation',
					userId,
					conversationId
				});
				// Don't throw - we still want to return the response to the user
				// but log the error for debugging
			}
		} catch (err) {
			logError('POST /api/ai-bestie/message', err, ErrorType.DATABASE_ERROR, {
				context: 'Failed to save message to database',
				userId,
				conversationId
			});
			// Don't throw - we still want to return the response to the user
		}

		// Auto-update preferences based on conversation (fire and forget)
		try {
			const allMessages = [...recentMessages, userMessageObj];
			await autoUpdateProfile('bestie', allMessages, null, userId, bookContext);
		} catch (err) {
			logError('POST /api/ai-bestie/message', err, ErrorType.INTERNAL_ERROR, {
				context: 'Failed to auto-update profile',
				userId
			});
			// Silently fail - don't break the response if auto-update fails
		}

		return json({
			reply: cleanText,
			citations: citationMatches,
			suggestions: suggestions.length > 0 ? suggestions : undefined
		});
	} catch (err) {
		// If error is already a SvelteKit error, re-throw it
		if (err instanceof Error && 'status' in err) {
			throw err;
		}

		// Log unexpected errors
		logError('POST /api/ai-bestie/message', err, ErrorType.INTERNAL_ERROR);
		throwInternalError('POST /api/ai-bestie/message', err, 'Failed to get AI Bestie response');
	}
};
