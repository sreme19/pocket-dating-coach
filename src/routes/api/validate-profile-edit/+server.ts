import { json, type RequestHandler } from '@sveltejs/kit';
import { getClaudeClient } from '$lib/claude';
import type { MaleProfile } from '$lib/types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { field, originalValue, newValue, profile } = await request.json() as {
			field: string;
			originalValue: string | string[];
			newValue: string;
			profile: MaleProfile;
		};

		// Cap edited value length (1000 chars). newValue is interpolated into a
		// Claude validation prompt, so unbounded input is a token-flooding /
		// prompt-injection vector.
		if (typeof newValue === 'string' && newValue.length > 1000) {
			return json({ error: 'Value exceeds maximum length of 1000 characters' }, { status: 400 });
		}

		// Quick validation rules
		const minLengths: Record<string, number> = {
			headline: 3,
			elevatorPitch: 20,
			firstDateVibe: 15,
			whyThisProfile: 15
		};

		if (minLengths[field]) {
			if (newValue.trim().length < minLengths[field]) {
				return json(
					{ error: `${field} must be at least ${minLengths[field]} characters` },
					{ status: 400 }
				);
			}
		}

		// For arrays, just validate not empty
		if (field === 'compatibilitySignals' || field === 'conversationStarters') {
			const items = newValue.split('\n').filter((s) => s.trim().length > 0);
			if (items.length === 0) {
				return json({ error: 'Must have at least one item' }, { status: 400 });
			}
		}

		// Simple Claude validation - check it still sounds authentic
		const client = getClaudeClient();
		const response = await client.messages.create({
			model: 'claude-sonnet-4-5-20250929',
			max_tokens: 200,
			messages: [
				{
					role: 'user',
					content: `Quick validation: Does this edit still fit the dating profile persona?

Field: ${field}
Original: "${originalValue}"
New: "${newValue}"

Profile summary: "${profile.headline}" - "${profile.elevatorPitch}"

Is the new text authentic, not cringe, and still consistent with the profile? Reply only with "VALID" or "INVALID: <reason>"`
				}
			]
		});

		const content = response.content[0];
		if (content.type !== 'text') {
			return json({ error: 'Validation failed' }, { status: 500 });
		}

		if (content.text.startsWith('INVALID')) {
			return json({ error: content.text.replace('INVALID: ', '').trim() }, { status: 400 });
		}

		return json({ valid: true });
	} catch (error) {
		console.error('Validation error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
