import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';

let _client: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
	if (!_client) {
		_client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
	}
	return _client;
}

export const CLAUDE_MODEL = 'claude-sonnet-4-5-20250929';
export const MAX_TOKENS = 2048;

export async function askClaude(systemPrompt: string, userMessage: string): Promise<string> {
	const client = getClaudeClient();
	const response = await client.messages.create({
		model: CLAUDE_MODEL,
		max_tokens: MAX_TOKENS,
		system: systemPrompt,
		messages: [{ role: 'user', content: userMessage }]
	});
	const block = response.content[0];
	if (block.type !== 'text') throw new Error('Unexpected response type from Claude');
	return block.text;
}

export async function askClaudeWithImage(
	systemPrompt: string,
	userMessage: string,
	imageBase64: string,
	mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
): Promise<string> {
	const client = getClaudeClient();
	const response = await client.messages.create({
		model: CLAUDE_MODEL,
		max_tokens: MAX_TOKENS,
		system: systemPrompt,
		messages: [
			{
				role: 'user',
				content: [
					{
						type: 'image',
						source: { type: 'base64', media_type: mediaType, data: imageBase64 }
					},
					{ type: 'text', text: userMessage }
				]
			}
		]
	});
	const block = response.content[0];
	if (block.type !== 'text') throw new Error('Unexpected response type from Claude');
	return block.text;
}

export async function streamClaude(
	systemPrompt: string,
	messages: Array<{ role: 'user' | 'assistant'; content: string }>,
	onChunk: (text: string) => void
): Promise<void> {
	const client = getClaudeClient();
	const stream = client.messages.stream({
		model: CLAUDE_MODEL,
		max_tokens: MAX_TOKENS,
		system: systemPrompt,
		messages
	});

	for await (const event of stream) {
		if (
			event.type === 'content_block_delta' &&
			event.delta.type === 'text_delta'
		) {
			onChunk(event.delta.text);
		}
	}
}
