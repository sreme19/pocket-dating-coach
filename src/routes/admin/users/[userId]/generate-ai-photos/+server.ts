import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
import { env } from '$env/dynamic/private';

const PERSONALITY_TRAITS = [
	{ name: 'Decisiveness', level: 'Very high', percentage: 95 },
	{ name: 'Warmth', level: 'High', percentage: 80 },
	{ name: 'Openness', level: 'High', percentage: 75 },
	{ name: 'Pace', level: 'Solid', percentage: 65 },
	{ name: 'Stability', level: 'High', percentage: 78 },
];

export const POST: RequestHandler = async ({ params, url: reqUrl }) => {
	const { userId } = params;
	const sb = getSupabase() as any;

	// Get user's reference photo from master profile
	const { data: master } = await sb
		.from('user_master_profile')
		.select('data')
		.eq('user_id', userId)
		.maybeSingle();

	const masterData = (master?.data ?? {}) as Record<string, any>;
	const photos: any[] = Array.isArray(masterData.photos) ? masterData.photos : [];
	const referenceImageUrl: string | null = photos[0]?.dataUrl ?? masterData.photos?.[0]?.url ?? null;

	if (!referenceImageUrl) {
		return json({ error: 'No reference photo found for this user' }, { status: 400 });
	}

	// Call personality-portrait API (internal call)
	const origin = reqUrl.origin;
	const portraitRes = await fetch(`${origin}/api/verified-vibe/personality-portrait`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			referenceImageUrl,
			personalityTraits: PERSONALITY_TRAITS,
		}),
	});

	if (!portraitRes.ok) {
		const err = await portraitRes.text();
		return json({ error: `Portrait generation failed: ${err}` }, { status: 500 });
	}

	const { imageUrl } = await portraitRes.json() as { imageUrl?: string };
	if (!imageUrl) return json({ error: 'No image URL returned' }, { status: 500 });

	// Save to master profile
	const updatedAiPhotos = [
		{ url: imageUrl, role: 'lead', scene: 'Lead photo' },
		...(Array.isArray(masterData.aiPhotos) ? masterData.aiPhotos.filter((p: any) => p.role !== 'lead') : []),
	];

	await sb.from('user_master_profile').upsert({
		user_id: userId,
		data: { ...masterData, aiPhotos: updatedAiPhotos, personalityPortraitUrl: imageUrl },
	}, { onConflict: 'user_id' });

	return json({ ok: true, imageUrl });
};
