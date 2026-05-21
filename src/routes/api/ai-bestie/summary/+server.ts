import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
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
	logError,
	ErrorType,
	validateClaudeResponse
} from '$lib/server/error-handler';
import { loadPreferences } from '$lib/server/profile-service';

/**
 * Match summary with key insights and compatibility signals
 */
export interface MatchSummary {
	matchId: string;
	matchName?: string;
	matchProfile?: Partial<UserProfile>;
	keyInsights: string[];
	greenFlags: string[];
	yellowFlags: string[];
	redFlags: string[];
	recommendedNextMove: string;
	conversationMomentum: 'heating_up' | 'steady' | 'cooling_down';
	lastMessageTime: number;
	messageCount: number;
}

/**
 * Summary response containing all match summaries
 */
export interface SummaryResponse {
	summaries: MatchSummary[];
	lastUpdated: number;
	totalMatches: number;
}

/**
 * POST /api/ai-bestie/summary
 * 
 * Retrieves hourly summaries of all matches with AI Bestie insights.
 * 
 * Request body:
 * {
 *   "userId": "uuid" (optional - uses authenticated user if not provided)
 * }
 * 
 * Response:
 * {
 *   "summaries": [
 *     {
 *       "matchId": "uuid",
 *       "matchName": "John",
 *       "keyInsights": ["Very engaged", "Shares your values"],
 *       "greenFlags": ["Asks thoughtful questions"],
 *       "yellowFlags": [],
 *       "redFlags": [],
 *       "recommendedNextMove": "Suggest meeting this week",
 *       "conversationMomentum": "heating_up",
 *       "lastMessageTime": 1704067200000,
 *       "messageCount": 15
 *     }
 *   ],
 *   "lastUpdated": 1704067200000,
 *   "totalMatches": 1
 * }
 * 
 * Requirements: 3.1, 3.2, 5.1, 5.2, 7.1, 7.2, 7.3
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	// Validate authentication
	const session = await locals.auth.getSession();
	if (!session?.user?.id) {
		throwAuthenticationError('User authentication required');
	}

	const userId = session.user.id;

	// Parse request body (optional userId override)
	let body: { userId?: string } = {};
	try {
		const text = await request.text();
		if (text) {
			body = JSON.parse(text);
		}
	} catch (err) {
		logError('POST /api/ai-bestie/summary', err, ErrorType.VALIDATION_ERROR);
		throwValidationError('Invalid JSON in request body');
	}

	// Use provided userId or authenticated user
	const targetUserId = body.userId || userId;

	// Validate userId is a non-empty string
	if (typeof targetUserId !== 'string' || targetUserId.trim().length === 0) {
		throwValidationError('userId must be a non-empty string');
	}

	try {
		// Load user's preferences to ensure they exist
		let preferences;
		try {
			preferences = await loadPreferences(targetUserId);
		} catch (err) {
			logError('POST /api/ai-bestie/summary', err, ErrorType.DATABASE_ERROR, {
				context: 'Failed to load preferences',
				userId: targetUserId
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
				'POST /api/ai-bestie/summary',
				new Error('User preferences are empty'),
				ErrorType.VALIDATION_ERROR,
				{ userId: targetUserId }
			);
			throwValidationError(
				'Your preferences profile is incomplete. Please set up your preferences before viewing summaries.'
			);
		}

		// Fetch all active AI Bestie conversations for the user
		const supabase = getSupabase();
		const { data: conversations, error: fetchError } = await supabase
			.from('ai_assistant_conversations')
			.select('*')
			.eq('user_id', targetUserId)
			.eq('assistant_type', 'bestie')
			.eq('is_active', true)
			.order('updated_at', { ascending: false });

		if (fetchError) {
			logError('POST /api/ai-bestie/summary', fetchError, ErrorType.DATABASE_ERROR, {
				context: 'Failed to fetch conversations',
				userId: targetUserId
			});
			throwDatabaseError(
				'POST /api/ai-bestie/summary',
				fetchError,
				'Failed to retrieve conversation history'
			);
		}

		// If no conversations, return empty summaries
		if (!conversations || conversations.length === 0) {
			return json({
				summaries: [],
				lastUpdated: Date.now(),
				totalMatches: 0
			} as SummaryResponse);
		}

		// Search for relevant book chunks for context
		let bookContext = '';
		try {
			const queryEmbedding = await getEmbedding('dating advice compatibility signals');
			if (queryEmbedding) {
				const chunks = await searchBookChunks(queryEmbedding, 5);
				bookContext = chunks.map(c => `[${c.chapter}]\n${c.content}`).join('\n\n---\n\n');
			}
		} catch (err) {
			logError('POST /api/ai-bestie/summary', err, ErrorType.EXTERNAL_API_ERROR, {
				context: 'Failed to search book chunks'
			});
			// Continue without book context - graceful fallback
			bookContext = 'No book context available.';
		}

		// Build system prompt for AI Bestie
		const userProfile: UserProfile = {
			gender: 'woman',
			ageRange: 'unknown',
			datingApp: 'other',
			relationshipGoal: 'not_sure'
		};

		const systemPrompt = buildAIBestieSystemPrompt(
			userProfile,
			bookContext || 'No book context available.',
			undefined,
			preferences
		);

		// Generate summaries for each conversation
		const summaries: MatchSummary[] = [];

		for (const conversation of conversations) {
			try {
				const messages: ChatMessage[] = conversation.messages || [];

				// Skip if no messages
				if (messages.length === 0) {
					continue;
				}

				// Get the last message timestamp
				const lastMessage = messages[messages.length - 1];
				const lastMessageTime = lastMessage.timestamp || Date.now();

				// Extract match name from conversation ID or use generic name
				const matchId = conversation.match_conversation_id || conversation.id;
				const matchName = `Match ${matchId.substring(0, 8)}`;

				// Format recent messages for analysis
				const recentMessages = messages.slice(-10);
				const messagesText = recentMessages
					.map(m => `${m.role === 'user' ? 'You' : 'Match'}: ${m.content}`)
					.join('\n');

				// Create summary generation prompt
				const summaryPrompt = `Analyze this conversation and provide a brief summary with key insights and compatibility signals.

Conversation (last 10 messages):
---
${messagesText}
---

Respond in this exact JSON format:
{
  "keyInsights": ["insight 1", "insight 2", "insight 3"],
  "greenFlags": ["flag 1", "flag 2"],
  "yellowFlags": ["flag 1"],
  "redFlags": [],
  "recommendedNextMove": "One sentence recommendation for next action",
  "conversationMomentum": "heating_up|steady|cooling_down"
}

Be concise and specific. Key insights should be 2-3 sentences max each.`;

				// Call Claude API
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
								content: summaryPrompt
							}
						]
					});
				} catch (err) {
					logError('POST /api/ai-bestie/summary', err, ErrorType.EXTERNAL_API_ERROR, {
						context: 'Claude API call failed for conversation',
						conversationId: conversation.id
					});
					// Skip this conversation if Claude fails
					continue;
				}

				// Validate Claude response
				const responseValidation = validateClaudeResponse(response);
				if (!responseValidation.valid) {
					logError(
						'POST /api/ai-bestie/summary',
						new Error(responseValidation.error),
						ErrorType.EXTERNAL_API_ERROR
					);
					// Skip this conversation if response is invalid
					continue;
				}

				const block = response.content[0];
				if (block.type !== 'text') {
					logError(
						'POST /api/ai-bestie/summary',
						new Error('Unexpected response type'),
						ErrorType.EXTERNAL_API_ERROR,
						{ blockType: block.type }
					);
					// Skip this conversation if response type is wrong
					continue;
				}

				const fullText = block.text;

				// Validate response text
				if (!fullText || typeof fullText !== 'string') {
					logError(
						'POST /api/ai-bestie/summary',
						new Error('Empty response text'),
						ErrorType.EXTERNAL_API_ERROR
					);
					// Skip this conversation if response is empty
					continue;
				}

				// Parse JSON response
				let summaryData = {
					keyInsights: [],
					greenFlags: [],
					yellowFlags: [],
					redFlags: [],
					recommendedNextMove: 'Continue the conversation',
					conversationMomentum: 'steady' as const
				};

				try {
					// Extract JSON object from response
					const jsonMatch = fullText.match(/\{[\s\S]*\}/);
					if (jsonMatch) {
						const parsed = JSON.parse(jsonMatch[0]);
						summaryData = {
							keyInsights: parsed.keyInsights || [],
							greenFlags: parsed.greenFlags || [],
							yellowFlags: parsed.yellowFlags || [],
							redFlags: parsed.redFlags || [],
							recommendedNextMove: parsed.recommendedNextMove || 'Continue the conversation',
							conversationMomentum: parsed.conversationMomentum || 'steady'
						};
					}
				} catch (err) {
					logError(
						'POST /api/ai-bestie/summary',
						err,
						ErrorType.INTERNAL_ERROR,
						{
							context: 'Failed to parse summary JSON',
							responseText: fullText
						}
					);
					// Use default values if parsing fails
				}

				// Create match summary
				const matchSummary: MatchSummary = {
					matchId,
					matchName,
					keyInsights: summaryData.keyInsights,
					greenFlags: summaryData.greenFlags,
					yellowFlags: summaryData.yellowFlags,
					redFlags: summaryData.redFlags,
					recommendedNextMove: summaryData.recommendedNextMove,
					conversationMomentum: summaryData.conversationMomentum,
					lastMessageTime,
					messageCount: messages.length
				};

				summaries.push(matchSummary);
			} catch (err) {
				logError('POST /api/ai-bestie/summary', err, ErrorType.INTERNAL_ERROR, {
					context: 'Failed to generate summary for conversation',
					conversationId: conversation.id
				});
				// Continue with next conversation if this one fails
				continue;
			}
		}

		// Sort summaries by last message time (most recent first)
		summaries.sort((a, b) => b.lastMessageTime - a.lastMessageTime);

		// Return summaries
		return json({
			summaries,
			lastUpdated: Date.now(),
			totalMatches: summaries.length
		} as SummaryResponse);
	} catch (err) {
		// If error is already a SvelteKit error, re-throw it
		if (err instanceof Error && 'status' in err) {
			throw err;
		}

		// Log unexpected errors
		logError('POST /api/ai-bestie/summary', err, ErrorType.INTERNAL_ERROR);
		throwInternalError('POST /api/ai-bestie/summary', err, 'Failed to generate summaries');
	}
};
