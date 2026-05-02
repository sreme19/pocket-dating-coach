import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { askClaudeWithImage } from '$lib/claude';
import { searchBookChunks } from '$lib/vectorstore';
import { getEmbedding } from '$lib/embeddings';
import { buildProfileAnalysisPrompt } from '$lib/prompts';
import type { UserProfile } from '$lib/types';

export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData();
	const imageFile = formData.get('image') as File | null;
	const userProfileRaw = formData.get('userProfile') as string | null;

	if (!imageFile) throw error(400, 'image required');

	const userProfile: UserProfile | null = userProfileRaw ? JSON.parse(userProfileRaw) : null;

	const imageBuffer = await imageFile.arrayBuffer();
	const imageBase64 = Buffer.from(imageBuffer).toString('base64');
	const mediaType = (imageFile.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

	const queryEmbedding = await getEmbedding('dating app profile bio photos prompts improvement tips');
	const chunks = await searchBookChunks(queryEmbedding, 6);
	const bookContext = chunks.map(c => `[${c.chapter}]\n${c.content}`).join('\n\n---\n\n');

	const systemPrompt = buildProfileAnalysisPrompt(userProfile, bookContext || 'No book context available yet.');

	const rawResponse = await askClaudeWithImage(
		systemPrompt,
		'Please analyze this dating app profile screenshot and provide structured feedback.',
		imageBase64,
		mediaType
	);

	let feedback;
	try {
		const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
		if (!jsonMatch) throw new Error('No JSON found');
		feedback = JSON.parse(jsonMatch[0]);
	} catch {
		throw error(500, 'Failed to parse analysis response');
	}

	return json({ feedback });
};
