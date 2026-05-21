import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getClaudeClient, CLAUDE_MODEL, MAX_TOKENS } from '$lib/claude';
import { searchBookChunks } from '$lib/vectorstore';
import { getEmbedding } from '$lib/embeddings';
import { buildAIBestieSystemPrompt } from '$lib/prompts';
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
import { loadPreferences } from '$lib/server/profile-service';
import { getSupabase } from '$lib/server/supabase';
import type { CompatibilityAnalysis } from '$lib/server/ai-assistant-service';

/**
 * POST /api/ai-bestie/analyze
 * 
 * Analyzes a match's message for compatibility flags (green/yellow/red).
 * 
 * Request body:
 * {
 *   "conversationId": "uuid",
 *   "matchMessage": "I'm really into hiking and travel. What about you?",
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
 *   "greenFlags": [
 *     { "signal": "Asks about your interests", "reason": "Shows genuine curiosity" }
 *   ],
 *   "yellowFlags": [
 *     { "signal": "Mentions travel early", "reason": "Could indicate expensive lifestyle" }
 *   ],
 *   "redFlags": [],
 *   "overallAssessment": "This looks promising! He's showing genuine interest and compatibility.",
 *   "citations": ["Based on: Compatibility Signals"]
 * }
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
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
		matchMessage: string;
		recentMessages?: ChatMessage[];
		matchedUserProfile?: Partial<UserProfile>;
	};

	try {
		body = await request.json();
	} catch (err) {
		logError('POST /api/ai-bestie/analyze', err, ErrorType.VALIDATION_ERROR);
		throwValidationError('Invalid JSON in request body');
	}

	// Validate required fields
	const { valid, missingFields } = validateRequiredFields(body, ['conversationId', 'matchMessage']);

	if (!valid) {
		throwValidationError(`Missing required fields: ${missingFields.join(', ')}`);
	}

	const { conversationId, matchMessage, recentMessages = [], matchedUserProfile } = body;

	// Validate conversationId is non-empty string
	if (typeof conversationId !== 'string' || conversationId.trim().length === 0) {
		throwValidationError('conversationId must be a non-empty string');
	}

	// Validate matchMessage is non-empty string
	if (typeof matchMessage !== 'string' || matchMessage.trim().length === 0) {
		throwValidationError('matchMessage must be a non-empty string');
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
			logError('POST /api/ai-bestie/analyze', err, ErrorType.DATABASE_ERROR, {
				context: 'Failed to load preferences',
				userId
			});
			throwValidationError(
				'Could not load your preferences. Please ensure your profile is set up.'
			);
		}

		// Validate that preferences are not empty
		if (
			!preferences ||
			(preferences.emotionalSignals.length === 0 &&
				preferences.lifestyleSignals.length === 0 &&
				preferences.boundaries.length === 0 &&
				preferences.dealbreakers.length === 0)
		) {
			logError(
				'POST /api/ai-bestie/analyze',
				new Error('User preferences are empty'),
				ErrorType.VALIDATION_ERROR,
				{ userId, conversationId }
			);
			throwValidationError(
				'Your preferences profile is incomplete. Please set up your preferences before analyzing matches.'
			);
		}

		// Search for relevant book chunks with error handling
		let bookContext = '';
		try {
			const queryEmbedding = await getEmbedding(matchMessage);
			if (!queryEmbedding) {
				logError('POST /api/ai-bestie/analyze', new Error('No embedding returned'), ErrorType.EXTERNAL_API_ERROR);
			} else {
				const chunks = await searchBookChunks(queryEmbedding, 5);
				bookContext = chunks.map(c => `[${c.chapter}]\n${c.content}`).join('\n\n---\n\n');
			}
		} catch (err) {
			logError('POST /api/ai-bestie/analyze', err, ErrorType.EXTERNAL_API_ERROR, {
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
			logError('POST /api/ai-bestie/analyze', err, ErrorType.INTERNAL_ERROR, {
				context: 'Failed to build system prompt'
			});
			throwInternalError('POST /api/ai-bestie/analyze', err, 'Failed to prepare AI Bestie context');
		}

		// Format preferences for the analysis prompt
		const preferencesText = `
Emotional signals valued: ${preferences.emotionalSignals.join(', ') || 'Not specified'}
Lifestyle signals: ${preferences.lifestyleSignals.join(', ') || 'Not specified'}
Maturity signals: ${preferences.maturitySignals?.join(', ') || 'Not specified'}
Boundaries: ${preferences.boundaries.join(', ') || 'Not specified'}
Dealbreakers: ${preferences.dealbreakers.join(', ') || 'Not specified'}
`;

		// Create the analysis prompt
		const analysisPrompt = `Analyze this message from a match for compatibility signals:

"${matchMessage}"

User's preferences:
${preferencesText}

Respond in this exact JSON format:
{
  "greenFlags": [
    { "signal": "...", "reason": "..." },
    { "signal": "...", "reason": "..." }
  ],
  "yellowFlags": [
    { "signal": "...", "reason": "..." }
  ],
  "redFlags": [
    { "signal": "...", "reason": "..." }
  ],
  "overallAssessment": "One paragraph assessment of compatibility.",
  "citations": ["Based on: [preference or book principle]"]
}

Be specific and grounded in the user's actual preferences. Only include flags that are clearly evident from the message.`;

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
						content: analysisPrompt
					}
				]
			});
		} catch (err) {
			logError('POST /api/ai-bestie/analyze', err, ErrorType.EXTERNAL_API_ERROR, {
				context: 'Claude API call failed'
			});
			throwExternalAPIError(
				'POST /api/ai-bestie/analyze',
				err,
				'Sorry, I couldn\'t analyze this match. Please try again.'
			);
		}

		// Validate Claude response
		const responseValidation = validateClaudeResponse(response);
		if (!responseValidation.valid) {
			logError('POST /api/ai-bestie/analyze', new Error(responseValidation.error), ErrorType.EXTERNAL_API_ERROR);
			throwExternalAPIError(
				'POST /api/ai-bestie/analyze',
				new Error(responseValidation.error),
				'Unexpected response format from AI service'
			);
		}

		const block = response.content[0];
		if (block.type !== 'text') {
			logError('POST /api/ai-bestie/analyze', new Error('Unexpected response type'), ErrorType.EXTERNAL_API_ERROR, {
				blockType: block.type
			});
			throwExternalAPIError(
				'POST /api/ai-bestie/analyze',
				new Error('Unexpected response type'),
				'Invalid response from AI service'
			);
		}

		const fullText = block.text;

		// Validate response text
		if (!fullText || typeof fullText !== 'string') {
			logError('POST /api/ai-bestie/analyze', new Error('Empty response text'), ErrorType.EXTERNAL_API_ERROR);
			throwExternalAPIError(
				'POST /api/ai-bestie/analyze',
				new Error('Empty response'),
				'AI service returned empty response'
			);
		}

		// Parse JSON response
		let analysis: CompatibilityAnalysis = {
			greenFlags: [],
			yellowFlags: [],
			redFlags: [],
			overallAssessment: 'Unable to analyze compatibility at this time.',
			citations: []
		};

		try {
			// Extract JSON object from response
			const jsonMatch = fullText.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				const parsed = JSON.parse(jsonMatch[0]);
				analysis = {
					greenFlags: parsed.greenFlags || [],
					yellowFlags: parsed.yellowFlags || [],
					redFlags: parsed.redFlags || [],
					overallAssessment: parsed.overallAssessment || '',
					citations: parsed.citations || []
				};
			}
		} catch (err) {
			logError('POST /api/ai-bestie/analyze', err, ErrorType.INTERNAL_ERROR, {
				context: 'Failed to parse compatibility analysis JSON',
				responseText: fullText
			});
			throwInternalError(
				'POST /api/ai-bestie/analyze',
				err,
				'Failed to parse compatibility analysis'
			);
		}

		// Save analysis to conversation history
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
			const matchMessageObj: ChatMessage = {
				role: 'user',
				content: matchMessage
			};

			const analysisMessageObj: ChatMessage = {
				role: 'assistant',
				content: JSON.stringify(analysis),
				assistantType: 'bestie',
				metadata: {
					type: 'compatibility_analysis'
				}
			};

			// Combine with existing messages or create new array
			const existingMessages = existingConversation?.messages || [];
			const updatedMessages = [...existingMessages, matchMessageObj, analysisMessageObj];

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
				logError('POST /api/ai-bestie/analyze', upsertError, ErrorType.DATABASE_ERROR, {
					context: 'Failed to save analysis to conversation',
					userId,
					conversationId
				});
				// Don't throw - we still want to return the analysis to the user
				// but log the error for debugging
			}
		} catch (err) {
			logError('POST /api/ai-bestie/analyze', err, ErrorType.DATABASE_ERROR, {
				context: 'Failed to save analysis to database',
				userId,
				conversationId
			});
			// Don't throw - we still want to return the analysis to the user
		}

		return json(analysis);
	} catch (err) {
		// If error is already a SvelteKit error, re-throw it
		if (err instanceof Error && 'status' in err) {
			throw err;
		}

		// Log unexpected errors
		logError('POST /api/ai-bestie/analyze', err, ErrorType.INTERNAL_ERROR);
		throwInternalError('POST /api/ai-bestie/analyze', err, 'Failed to analyze match compatibility');
	}
};
