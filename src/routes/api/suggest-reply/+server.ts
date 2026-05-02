import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { askClaude } from '$lib/claude';
import { searchBookChunks } from '$lib/vectorstore';
import { getEmbedding } from '$lib/embeddings';
import { buildReplyPrompt } from '$lib/prompts';
import type { UserProfile } from '$lib/types';

export const POST: RequestHandler = async ({ request }) => {
	let body: {
		conversationHistory: string;
		matchLastMessage: string;
		userProfile: UserProfile | null;
	};

	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const { conversationHistory, matchLastMessage, userProfile } = body;
	if (!matchLastMessage?.trim()) throw error(400, 'matchLastMessage required');

	const queryEmbedding = await getEmbedding(`how to reply to: ${matchLastMessage}`);
	const chunks = await searchBookChunks(queryEmbedding, 5);
	const bookContext = chunks.map(c => `[${c.chapter}]\n${c.content}`).join('\n\n---\n\n');

	const systemPrompt = buildReplyPrompt(
		userProfile,
		bookContext || 'No book context available yet.',
		conversationHistory || '(No prior conversation provided)',
		matchLastMessage
	);

	const rawResponse = await askClaude(systemPrompt, 'Generate 3 reply options as specified.');

	let replies;
	try {
		const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
		if (!jsonMatch) throw new Error('No JSON array found');
		replies = JSON.parse(jsonMatch[0]);
	} catch {
		throw error(500, 'Failed to parse reply suggestions');
	}

	return json({ replies });
};
