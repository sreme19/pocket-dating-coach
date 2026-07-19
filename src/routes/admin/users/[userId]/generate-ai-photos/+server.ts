import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';

export const POST: RequestHandler = async ({ params, url: reqUrl }) => {
	const { userId } = params;
	const sb = getSupabase() as any;

	// Get user's reference photos and archetype from master profile
	const [{ data: master }, { data: user }] = await Promise.all([
		sb.from('user_master_profile').select('data').eq('user_id', userId).maybeSingle(),
		sb.from('verified_vibe_users').select('archetype, gender').eq('id', userId).single(),
	]);

	const masterData = (master?.data ?? {}) as Record<string, any>;
	const photos: any[] = Array.isArray(masterData.photos) ? masterData.photos : [];

	if (photos.length === 0) {
		return json({ error: 'No reference photos found for this user' }, { status: 400 });
	}

	// Download photos and convert to base64 data URLs
	const referenceDataUrls: string[] = [];
	for (const p of photos.slice(0, 3)) {
		const photoUrl = p?.dataUrl ?? p?.url;
		if (!photoUrl) continue;
		try {
			const res = await fetch(photoUrl);
			if (!res.ok) continue;
			const contentType = res.headers.get('content-type') ?? 'image/jpeg';
			const buffer = await res.arrayBuffer();
			const b64 = Buffer.from(buffer).toString('base64');
			referenceDataUrls.push(`data:${contentType};base64,${b64}`);
		} catch {
			// skip failed downloads
		}
	}

	if (referenceDataUrls.length === 0) {
		return json({ error: 'Could not download reference photos' }, { status: 400 });
	}

	// Call the real photo-enhance endpoint
	const enhanceRes = await fetch(`${reqUrl.origin}/api/photo-enhance/generate`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			referenceDataUrl: referenceDataUrls[0],
			referenceDataUrls,
			archetype: user?.archetype ?? 'casual_man',
			count: 3,
			rejectedPhotos: [],
		}),
	});

	if (!enhanceRes.ok) {
		const body = await enhanceRes.json().catch(() => ({})) as any;
		return json({ error: body?.message ?? body?.error ?? 'Enhancement failed' }, { status: 500 });
	}

	const result = await enhanceRes.json() as { photos: { url: string; role: string; scene: string }[]; errors?: any[] };

	if (!result.photos?.length) {
		return json({ error: 'No photos generated' }, { status: 500 });
	}

	// Save AI photos to master profile
	const aiPhotos = result.photos.map((p) => ({ url: p.url, role: p.role, scene: p.scene }));
	const leadPhoto = aiPhotos.find((p) => p.role === 'lead') ?? aiPhotos[0];

	await sb.from('user_master_profile').upsert({
		user_id: userId,
		data: { ...masterData, aiPhotos, personalityPortraitUrl: leadPhoto.url },
	}, { onConflict: 'user_id' });

	// Update avatar_url so discovery shows the AI photo
	await sb.from('verified_vibe_users')
		.update({ avatar_url: leadPhoto.url })
		.eq('id', userId);

	return json({ ok: true, photos: aiPhotos });
};
