import { json, type RequestHandler } from '@sveltejs/kit';
import { searchBookChunks } from '$lib/vectorstore';
import { buildMaleProfileGenerationPrompt } from '$lib/prompts';
import { getClaudeClient } from '$lib/claude';
import { formatIntakeForPrompt, getMaleProfileIntake, getProfileChatHistory } from '$lib/male-profile';
import type { UserProfile, MaleProfile } from '$lib/types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { userProfile } = await request.json() as { userProfile: UserProfile | null };

		// Get intake and chat data
		const intake = getMaleProfileIntake();
		if (!intake) {
			return json({ error: 'No profile intake data found' }, { status: 400 });
		}

		const intakeEvidence = formatIntakeForPrompt(intake);

		const chatHistory = getProfileChatHistory();
		const chatHistoryStr = chatHistory
			.map((m) => `${m.role === 'user' ? 'Him' : 'Coach'}: ${m.content}`)
			.join('\n');

		// Retrieve book context
		const bookChunks = await searchBookChunks(
			'personality values compatibility strengths dating authenticity' as unknown as number[],
			5
		);
		const bookContext = bookChunks.map((c) => c.content).join('\n\n---\n\n');

		// Build prompt
		const systemPrompt = buildMaleProfileGenerationPrompt(
			userProfile,
			bookContext,
			intakeEvidence,
			chatHistoryStr
		);

		// Call Claude
		const client = getClaudeClient();
		const response = await client.messages.create({
			model: 'claude-sonnet-4-5-20250929',
			max_tokens: 1500,
			system: [
				{
					type: 'text',
					text: systemPrompt,
					cache_control: { type: 'ephemeral' }
				}
			],
			messages: [
				{
					role: 'user',
					content: 'Generate the psychographic profile based on all the evidence and conversation.'
				}
			]
		});

		const content = response.content[0];
		if (content.type !== 'text') {
			return json({ error: 'Unexpected response type' }, { status: 500 });
		}

		// Extract JSON from response
		const jsonMatch = content.text.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return json({ error: 'Failed to extract profile JSON' }, { status: 500 });
		}

		const profile: MaleProfile = JSON.parse(jsonMatch[0]);

		return json({
			profile: {
				...profile,
				generatedAt: Date.now()
			},
			inputTokens: response.usage.input_tokens,
			outputTokens: response.usage.output_tokens
		});
	} catch (error) {
		console.error('Profile generation error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
