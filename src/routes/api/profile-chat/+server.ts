import { json, type RequestHandler } from '@sveltejs/kit';
import { searchBookChunks } from '$lib/vectorstore';
import { buildProfileChatPrompt } from '$lib/prompts';
import { getClaudeClient } from '$lib/claude';
import { formatIntakeForPrompt } from '$lib/male-profile';
import type { UserProfile, ProfileChatMessage, MaleProfileIntake } from '$lib/types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { mode, userProfile, chatHistory } = await request.json() as {
			mode: 'initial' | 'continue';
			userProfile: UserProfile | null;
			chatHistory?: ProfileChatMessage[];
		};

		// Get intake data
		const intakeJson = request.headers.get('cookie')?.includes('pdc_male_intake')
			? localStorage?.getItem('pdc_male_intake')
			: null;

		let intakeEvidence = 'No intake data yet.';
		if (intakeJson) {
			try {
				const intake: MaleProfileIntake = JSON.parse(intakeJson);
				intakeEvidence = formatIntakeForPrompt(intake);
			} catch (e) {
				console.error('Failed to parse intake:', e);
			}
		}

		// Retrieve book context
		const query = mode === 'initial'
			? 'personality strengths what makes someone interesting dating profile'
			: 'personality values compatibility dating profile psychology';

		const bookChunks = await searchBookChunks(query as unknown as number[], 4);
		const bookContext = bookChunks.map((c) => c.content).join('\n\n---\n\n');

		// Format chat history for prompt
		let chatHistoryStr = '';
		if (chatHistory && chatHistory.length > 0) {
			chatHistoryStr = chatHistory
				.map((m) => `${m.role === 'user' ? 'Him' : 'Coach'}: ${m.content}`)
				.join('\n');
		}

		// Build prompt
		const systemPrompt = buildProfileChatPrompt(
			userProfile,
			bookContext,
			intakeEvidence,
			chatHistoryStr
		);

		// Call Claude
		const client = getClaudeClient();
		const response = await client.messages.create({
			model: 'claude-sonnet-4-5-20250929',
			max_tokens: 500,
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
					content:
						mode === 'initial'
							? 'What would you like to know first?'
							: 'What should I ask next to refine the profile?'
				}
			]
		});

		const content = response.content[0];
		if (content.type !== 'text') {
			return json({ error: 'Unexpected response type' }, { status: 500 });
		}

		return json({
			question: content.text,
			inputTokens: response.usage.input_tokens,
			outputTokens: response.usage.output_tokens
		});
	} catch (error) {
		console.error('Profile chat error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
