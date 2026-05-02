import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getClaudeClient, CLAUDE_MODEL, MAX_TOKENS } from '$lib/claude';
import { searchBookChunks } from '$lib/vectorstore';
import { getEmbedding } from '$lib/embeddings';
import { buildChatSystemPrompt } from '$lib/prompts';
import type { UserProfile } from '$lib/types';

export const POST: RequestHandler = async ({ request }) => {
	let body: { messages: Array<{ role: string; content: string }>; userProfile: UserProfile | null };

	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const { messages, userProfile } = body;
	if (!messages || !Array.isArray(messages) || messages.length === 0) {
		throw error(400, 'messages required');
	}

	const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';

	const queryEmbedding = await getEmbedding(lastUserMessage);
	const chunks = await searchBookChunks(queryEmbedding, 5);
	const bookContext = chunks.map(c => `[${c.chapter}]\n${c.content}`).join('\n\n---\n\n');

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
};
