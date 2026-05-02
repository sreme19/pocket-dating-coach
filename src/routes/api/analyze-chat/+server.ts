import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { askClaude, askClaudeWithImage } from '$lib/claude';
import { searchBookChunks } from '$lib/vectorstore';
import { getEmbedding } from '$lib/embeddings';
import { buildChatAnalysisPrompt } from '$lib/prompts';
import type { UserProfile } from '$lib/types';

export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData();
	const imageFile = formData.get('image') as File | null;
	const text = formData.get('text') as string | null;
	const userProfileRaw = formData.get('userProfile') as string | null;

	if (!imageFile && !text?.trim()) throw error(400, 'image or text required');

	const userProfile: UserProfile | null = userProfileRaw ? JSON.parse(userProfileRaw) : null;

	const queryEmbedding = await getEmbedding('dating app conversation analysis messaging communication tips');
	const chunks = await searchBookChunks(queryEmbedding, 5);
	const bookContext = chunks.map(c => `[${c.chapter}]\n${c.content}`).join('\n\n---\n\n');

	const systemPrompt = buildChatAnalysisPrompt(userProfile, bookContext || 'No book context available yet.');

	let rawResponse: string;

	if (imageFile) {
		const imageBuffer = await imageFile.arrayBuffer();
		const imageBase64 = Buffer.from(imageBuffer).toString('base64');
		const mediaType = (imageFile.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
		rawResponse = await askClaudeWithImage(
			systemPrompt,
			'Please analyze this dating app conversation screenshot.',
			imageBase64,
			mediaType
		);
	} else {
		rawResponse = await askClaude(
			systemPrompt,
			`Please analyze this conversation:\n\n${text}`
		);
	}

	let analysis;
	try {
		const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
		if (!jsonMatch) throw new Error('No JSON found');
		analysis = JSON.parse(jsonMatch[0]);
	} catch {
		throw error(500, 'Failed to parse analysis response');
	}

	return json({ analysis });
};
