import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getClaudeClient, CLAUDE_MODEL, MAX_TOKENS } from '$lib/claude';
import { searchBookChunks } from '$lib/vectorstore';
import { getEmbedding } from '$lib/embeddings';
import { buildChatSystemPrompt } from '$lib/prompts';
import type { UserProfile, ChatMessage } from '$lib/types';
import { routeMessage, type MessageRoutingContext } from '$lib/server/message-router';
import { generateResponse } from '$lib/server/ai-assistant-service';
import { loadPreferences, loadPersonality } from '$lib/server/profile-service';

export const POST: RequestHandler = async ({ request }) => {
	let body: {
		messages: ChatMessage[];
		userProfile: UserProfile | null;
		matchId?: string;
		matchedUserProfile?: Partial<UserProfile>;
	};

	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const { messages, userProfile, matchId, matchedUserProfile } = body;
	if (!messages || !Array.isArray(messages) || messages.length === 0) {
		throw error(400, 'messages required');
	}

	// Get the last user message
	const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';
	if (!lastUserMessage) {
		throw error(400, 'No user message found');
	}

	try {
		// Get book context for system prompt
		const queryEmbedding = await getEmbedding(lastUserMessage);
		const chunks = await searchBookChunks(queryEmbedding, 5);
		const bookContext = chunks.map(c => `[${c.chapter}]\n${c.content}`).join('\n\n---\n\n');

		// If matchId is provided, route through message router to check for AI assistants
		if (matchId && userProfile) {
			const routingContext: MessageRoutingContext = {
				userId: userProfile.gender === 'man' ? 'user-id' : 'user-id', // In real implementation, get from auth
				matchId,
				userMessage: lastUserMessage,
				conversationHistory: messages,
				userProfile,
				matchedUserProfile,
				bookContext: bookContext || 'No book context available yet.'
			};

			const routeResult = await routeMessage(routingContext);

			// If an AI assistant is active and can continue, it will handle the response
			if ((routeResult.type === 'ai-bestie' || routeResult.type === 'ai-wingman') && routeResult.canContinue) {
				// The message router already generated the response via generateResponse
				// We need to call generateResponse here to get the actual response
				const assistantType = routeResult.assistantType!;
				const profileData =
					assistantType === 'bestie' ? await loadPreferences(userProfile.gender === 'man' ? 'user-id' : 'user-id') : await loadPersonality(userProfile.gender === 'man' ? 'user-id' : 'user-id');

				const response = await generateResponse(
					assistantType,
					lastUserMessage,
					messages,
					userProfile,
					{
						matchedUserProfile,
						recentMessages: messages.slice(-10),
						messageCount: messages.length
					},
					bookContext || 'No book context available yet.',
					profileData
				);

				return json({
					reply: response.reply,
					citations: response.citations,
					assistantType: assistantType
				});
			}

			// If AI assistant reached limit, return warning
			if ((routeResult.type === 'ai-bestie' || routeResult.type === 'ai-wingman') && !routeResult.canContinue) {
				throw error(429, routeResult.warning || 'AI assistant has reached exchange limit');
			}

			// If deactivation command, return success
			if (routeResult.shouldDeactivate) {
				return json({
					reply: `AI ${routeResult.assistantType} deactivated. You can reactivate it anytime.`,
					citations: [],
					assistantType: undefined
				});
			}

			// If activation command, return success
			if (routeResult.shouldActivate) {
				return json({
					reply: `AI ${routeResult.assistantType} activated. I'll help you navigate this conversation with strategic advice.`,
					citations: [],
					assistantType: routeResult.assistantType
				});
			}
		}

		// No AI assistant is active - use regular "Ask Your Coach" mode
		const systemPrompt = buildChatSystemPrompt(userProfile, bookContext || 'No book context available yet.');

		const client = getClaudeClient();
		const response = await client.messages.create({
			model: CLAUDE_MODEL,
			max_tokens: MAX_TOKENS,
			system: systemPrompt,
			messages: messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
		});

		const block = response.content[0];
		if (block.type !== 'text') throw error(500, 'Unexpected response');

		const fullText = block.text;
		const citationMatches = [...fullText.matchAll(/\*Based on:([^*]+)\*/g)].map(m => `Based on:${m[1].trim()}`);
		const cleanText = fullText.replace(/\*Based on:[^*]+\*/g, '').trim();

		return json({ reply: cleanText, citations: citationMatches });
	} catch (err) {
		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		// Error handling following existing patterns
		if (err instanceof Error) {
			console.error('Chat endpoint error:', err.message);

			// Handle specific error types
			if (err.message.includes('Claude API')) {
				throw error(503, 'Sorry, I couldn\'t generate a response. Please try again.');
			}
			if (err.message.includes('database')) {
				throw error(500, 'Your message wasn\'t saved. Please check your connection and try again.');
			}
			if (err.message.includes('profile')) {
				throw error(400, 'We couldn\'t load your profile data. Using default advice mode.');
			}
		}

		throw error(500, 'An unexpected error occurred');
	}
};
