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

export const POST: RequestHandler = async ({ request, locals }) => {
	// Check authentication
	const session = await locals.auth.getSession();
	if (!session?.user) {
		throw error(401, 'Unauthorized');
	}

	let body: AIAssistantRequest;

	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const { conversationId, assistantType, messages, matchContext } = body;

	if (!conversationId || !assistantType || !messages || !Array.isArray(messages)) {
		throw error(400, 'Missing required fields: conversationId, assistantType, messages');
	}

	if (assistantType !== 'bestie' && assistantType !== 'wingman') {
		throw error(400, 'Invalid assistantType: must be "bestie" or "wingman"');
	}

	if (messages.length === 0) {
		throw error(400, 'messages array cannot be empty');
	}

	try {
		// Get the last user message for embedding search
		const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';

		// Search for relevant book chunks
		const queryEmbedding = await getEmbedding(lastUserMessage);
		const chunks = await searchBookChunks(queryEmbedding, 5);
		const bookContext = chunks.map(c => `[${c.chapter}]\n${c.content}`).join('\n\n---\n\n');

		// Build system prompt based on assistant type
		let systemPrompt: string;
		if (assistantType === 'bestie') {
			systemPrompt = buildAIBestieSystemPrompt(
				matchContext?.matchedUserProfile as UserProfile | undefined,
				bookContext || 'No book context available yet.',
				matchContext?.matchedUserProfile
			);
		} else {
			systemPrompt = buildAIWingmanSystemPrompt(
				matchContext?.matchedUserProfile as UserProfile | undefined,
				bookContext || 'No book context available yet.',
				matchContext?.matchedUserProfile
			);
		}

		// Add context about recent messages if provided
		if (matchContext?.recentMessages && matchContext.recentMessages.length > 0) {
			const recentMessagesText = matchContext.recentMessages
				.slice(-5)
				.map(m => `${m.role === 'user' ? 'You' : 'Them'}: ${m.content}`)
				.join('\n');

			const matchedUserInfo = matchContext.matchedUserProfile
				? `Gender: ${matchContext.matchedUserProfile.gender}, Age: ${matchContext.matchedUserProfile.ageRange}, Goal: ${matchContext.matchedUserProfile.relationshipGoal}`
				: 'No profile info available';

			const contextPrompt = buildAIAssistantContextPrompt(
				assistantType,
				recentMessagesText,
				matchedUserInfo
			);

			systemPrompt += '\n\n' + contextPrompt;
		}

		// Call Claude API
		const client = getClaudeClient();
		const response = await client.messages.create({
			model: CLAUDE_MODEL,
			max_tokens: MAX_TOKENS,
			system: systemPrompt,
			messages: messages.map(m => ({
				role: m.role as 'user' | 'assistant',
				content: m.content
			}))
		});

		const block = response.content[0];
		if (block.type !== 'text') {
			throw error(500, 'Unexpected response type from Claude');
		}

		const fullText = block.text;

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
		console.error('AI Assistant error:', err);
		if (err instanceof Error && err.message.includes('401')) {
			throw error(401, 'Unauthorized');
		}
		throw error(500, 'Failed to get AI assistant response');
	}
};
