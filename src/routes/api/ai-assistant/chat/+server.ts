import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getClaudeClient, CLAUDE_MODEL, MAX_TOKENS } from '$lib/claude';
import { searchBookChunks } from '$lib/vectorstore';
import { getEmbedding } from '$lib/embeddings';
import {
	buildAIBestieSystemPrompt,
	buildAIWingmanSystemPrompt,
	buildAIAssistantContextPrompt
} from '$lib/prompts';
import type { UserProfile, AIAssistantRequest, AIAssistantResponse } from '$lib/types';
import {
	throwAuthenticationError,
	throwValidationError,
	throwExternalAPIError,
	throwInternalError,
	validateRequiredFields,
	validateEnumValue,
	validateArrayLength,
	logError,
	ErrorType,
	validateClaudeResponse
} from '$lib/server/error-handler';

/**
 * POST /api/ai-assistant/chat
 * 
 * Generate AI assistant response to user message
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	// Validate authentication
	const session = await locals.auth.getSession();
	if (!session?.user) {
		throwAuthenticationError('User authentication required');
	}

	// Parse and validate request body
	let body: AIAssistantRequest;
	try {
		body = await request.json();
	} catch (err) {
		logError('AI Assistant Chat', err, ErrorType.VALIDATION_ERROR);
		throwValidationError('Invalid JSON in request body');
	}

	// Validate required fields
	const { valid, missingFields } = validateRequiredFields(body as unknown as Record<string, unknown>, [
		'conversationId',
		'assistantType',
		'messages'
	]);

	if (!valid) {
		throwValidationError(`Missing required fields: ${missingFields.join(', ')}`);
	}

	const { conversationId, assistantType, messages, matchContext } = body;

	// Validate conversationId is non-empty string
	if (typeof conversationId !== 'string' || conversationId.trim().length === 0) {
		throwValidationError('conversationId must be a non-empty string');
	}

	// Validate assistantType enum
	const assistantTypeValidation = validateEnumValue(assistantType, ['bestie', 'wingman']);
	if (!assistantTypeValidation.valid) {
		throwValidationError(`Invalid assistantType: ${assistantTypeValidation.error}`);
	}

	// Validate messages array
	const messagesValidation = validateArrayLength(messages, 1);
	if (!messagesValidation.valid) {
		throwValidationError(messagesValidation.error ?? '');
	}

	// Validate message structure
	if (!Array.isArray(messages)) {
		throwValidationError('messages must be an array');
	}

	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i];
		if (!msg.role || !msg.content) {
			throwValidationError(`Message at index ${i} missing required fields: role, content`);
		}
		if (typeof msg.content !== 'string' || msg.content.trim().length === 0) {
			throwValidationError(`Message at index ${i} content must be a non-empty string`);
		}
	}

	try {
		// Get the last user message for embedding search
		const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';

		if (!lastUserMessage || lastUserMessage.trim().length === 0) {
			throwValidationError('No user message found in conversation history');
		}

		// Search for relevant book chunks with error handling
		let bookContext = '';
		try {
			const queryEmbedding = await getEmbedding(lastUserMessage);
			if (!queryEmbedding) {
				logError('AI Assistant Chat', new Error('No embedding returned'), ErrorType.EXTERNAL_API_ERROR);
			} else {
				const chunks = await searchBookChunks(queryEmbedding, 5);
				bookContext = chunks.map(c => `[${c.chapter}]\n${c.content}`).join('\n\n---\n\n');
			}
		} catch (err) {
			logError('AI Assistant Chat', err, ErrorType.EXTERNAL_API_ERROR, {
				context: 'Failed to search book chunks'
			});
			// Continue without book context - graceful fallback
			bookContext = 'No book context available.';
		}

		// Build system prompt based on assistant type
		let systemPrompt: string;
		try {
			if (assistantType === 'bestie') {
				systemPrompt = buildAIBestieSystemPrompt(
					(matchContext?.matchedUserProfile ?? null) as UserProfile | null,
					bookContext || 'No book context available.',
					matchContext?.matchedUserProfile
				);
			} else {
				systemPrompt = buildAIWingmanSystemPrompt(
					(matchContext?.matchedUserProfile ?? null) as UserProfile | null,
					bookContext || 'No book context available.',
					matchContext?.matchedUserProfile
				);
			}
		} catch (err) {
			logError('AI Assistant Chat', err, ErrorType.INTERNAL_ERROR, {
				context: 'Failed to build system prompt'
			});
			throwInternalError('AI Assistant Chat', err, 'Failed to prepare assistant context');
		}

		// Add context about recent messages if provided
		if (matchContext?.recentMessages && Array.isArray(matchContext.recentMessages) && matchContext.recentMessages.length > 0) {
			try {
				const recentMessagesText = matchContext.recentMessages
					.slice(-5)
					.map(m => `${m.role === 'user' ? 'You' : 'Them'}: ${m.content}`)
					.join('\n');

				const matchedUserInfo = matchContext.matchedUserProfile
					? `Gender: ${matchContext.matchedUserProfile.gender}, Age: ${matchContext.matchedUserProfile.ageRange}, Goal: ${matchContext.matchedUserProfile.relationshipGoal}`
					: 'No profile info available';

				const contextPrompt = buildAIAssistantContextPrompt(
					assistantType as 'bestie' | 'wingman',
					recentMessagesText,
					matchedUserInfo
				);

				systemPrompt += '\n\n' + contextPrompt;
			} catch (err) {
				logError('AI Assistant Chat', err, ErrorType.INTERNAL_ERROR, {
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
				messages: messages.map(m => ({
					role: m.role as 'user' | 'assistant',
					content: m.content
				}))
			});
		} catch (err) {
			logError('AI Assistant Chat', err, ErrorType.EXTERNAL_API_ERROR, {
				context: 'Claude API call failed'
			});
			throwExternalAPIError('AI Assistant Chat', err, 'Sorry, I couldn\'t generate a response. Please try again.');
		}

		// Validate Claude response
		const responseValidation = validateClaudeResponse(response);
		if (!responseValidation.valid) {
			logError('AI Assistant Chat', new Error(responseValidation.error), ErrorType.EXTERNAL_API_ERROR);
			throwExternalAPIError('AI Assistant Chat', new Error(responseValidation.error), 'Unexpected response format from AI service');
		}

		const block = response.content[0];
		if (block.type !== 'text') {
			logError('AI Assistant Chat', new Error('Unexpected response type'), ErrorType.EXTERNAL_API_ERROR, {
				blockType: block.type
			});
			throwExternalAPIError('AI Assistant Chat', new Error('Unexpected response type'), 'Invalid response from AI service');
		}

		const fullText = block.text;

		// Validate response text
		if (!fullText || typeof fullText !== 'string') {
			logError('AI Assistant Chat', new Error('Empty response text'), ErrorType.EXTERNAL_API_ERROR);
			throwExternalAPIError('AI Assistant Chat', new Error('Empty response'), 'AI service returned empty response');
		}

		// Extract citations
		const citationMatches = [...fullText.matchAll(/\*Based on:([^*]+)\*/g)].map(
			m => `Based on:${m[1].trim()}`
		);

		// Remove citations from the main text
		const cleanText = fullText.replace(/\*Based on:[^*]+\*/g, '').trim();

		const result: AIAssistantResponse = {
			reply: cleanText,
			citations: citationMatches
		};

		return json(result);
	} catch (err) {
		// If error is already a SvelteKit error, re-throw it
		if (err instanceof Error && err.message.includes('SvelteKit')) {
			throw err;
		}

		// Log unexpected errors
		logError('AI Assistant Chat', err, ErrorType.INTERNAL_ERROR);
		throwInternalError('AI Assistant Chat', err, 'Failed to get AI assistant response');
	}
};
