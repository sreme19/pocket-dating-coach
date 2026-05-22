import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
import { askClaude } from '$lib/claude';

/**
 * POST /api/verified-vibe/sync-profile
 *
 * Regenerates a user's `about` text in verified_vibe_users from their latest
 * ai_assistant_profiles data, then clears the profile_section_stale flag.
 *
 * Call this when profile_section_stale = true for a user (e.g. on profile page
 * load or discovery feed load once those APIs are fully wired).
 *
 * Body: { userId: string }
 *
 * Note: profile_section_stale and is_current are added by migration
 * 20260522_profile_section_staleness.sql — type assertions are used until
 * Supabase types are regenerated after that migration runs.
 */
export const POST: RequestHandler = async ({ request }) => {
	const { userId } = await request.json() as { userId: string };

	if (!userId) {
		return json({ error: 'userId required' }, { status: 400 });
	}

	const supabase = getSupabase();

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const db = supabase as any;

	// 1. Fetch the user row — check if actually stale
	const { data: userRow, error: userErr } = await db
		.from('verified_vibe_users')
		.select('id, first_name, gender, profile_section_stale')
		.eq('id', userId)
		.single();

	if (userErr || !userRow) {
		return json({ error: 'User not found' }, { status: 404 });
	}

	if (!userRow.profile_section_stale) {
		return json({ synced: false, reason: 'not_stale' });
	}

	// 2. Fetch their latest ai_assistant_profiles entry
	const profileType = userRow.gender === 'woman' ? 'preferences' : 'personality';
	const { data: profileRow, error: profileErr } = await db
		.from('ai_assistant_profiles')
		.select('data')
		.eq('user_id', userId)
		.eq('profile_type', profileType)
		.eq('is_current', true)
		.maybeSingle();

	if (profileErr || !profileRow) {
		return json({ error: 'No profile data found' }, { status: 404 });
	}

	// 3. Generate a refreshed about text from the structured profile data
	const profileData = profileRow.data as Record<string, unknown>;
	const prompt = buildAboutPrompt(userRow.first_name, userRow.gender, profileType, profileData);

	const about = await askClaude(
		'You write concise, authentic first-person "About me" text for dating profiles. Return only the text, no quotes.',
		prompt
	);

	// 4. Update verified_vibe_users with new about text and clear stale flag
	const { error: updateErr } = await db
		.from('verified_vibe_users')
		.update({
			about: about.trim(),
			profile_section_stale: false,
			updated_at: new Date().toISOString()
		})
		.eq('id', userId);

	if (updateErr) {
		return json({ error: 'Failed to update profile' }, { status: 500 });
	}

	return json({ synced: true, about: about.trim() });
};

function buildAboutPrompt(
	firstName: string,
	gender: string,
	profileType: string,
	data: Record<string, unknown>
): string {
	if (profileType === 'preferences') {
		const signals = (data.emotionalSignals as string[] | undefined) ?? [];
		const dealbreakers = (data.dealbreakers as string[] | undefined) ?? [];
		const lifestyle = (data.lifestyleSignals as string[] | undefined) ?? [];
		return `Write a 2-sentence "About me" for ${firstName}, a woman on a dating app.
She values: ${signals.slice(0, 3).join(', ')}.
Her lifestyle priorities: ${lifestyle.slice(0, 2).join(', ')}.
Hard nos: ${dealbreakers.slice(0, 2).join(', ')}.
Sound warm, self-aware, and specific — not generic.`;
	} else {
		const vibe = (data.personalityVibe as string | undefined) ?? '';
		const values = (data.values as string[] | undefined) ?? [];
		const style = (data.communicationStyle as string | undefined) ?? '';
		return `Write a 2-sentence "About me" for ${firstName}, a man on a dating app.
His personality: ${vibe.slice(0, 200)}.
What he values: ${values.slice(0, 3).join(', ')}.
How he communicates: ${style}.
Sound grounded, genuine, and specific — not generic.`;
	}
}
