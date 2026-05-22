import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { askClaude } from '$lib/claude';

export const POST: RequestHandler = async ({ request }) => {
	const { transcript } = await request.json() as { transcript: string };

	if (!transcript?.trim()) {
		return json({ cleaned: transcript ?? '' });
	}

	const cleaned = await askClaude(
		`You are a transcript editor. The user spoke into a microphone and the text was auto-transcribed.
Fix grammatical errors, remove filler words (um, uh, like, you know), clean up repetitions, and make the text read naturally as a typed message.
Return ONLY the cleaned text. No explanations, no quotes, no preamble.`,
		transcript
	);

	return json({ cleaned });
};
