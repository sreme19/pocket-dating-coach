import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ADMIN_COOKIE, REVIEWER_COOKIE, tokenIsValid } from '$lib/server/admin-auth';
import { listGeneratedPhotos, savePhotoReview } from '$lib/server/photo-review';

// GET — list already-generated AI photos + the human tags applied so far.
export const GET: RequestHandler = async ({ cookies, url }) => {
	if (!tokenIsValid(cookies.get(ADMIN_COOKIE))) {
		return json({ error: 'unauthorized' }, { status: 401 });
	}
	const limit = Math.min(1000, Number(url.searchParams.get('limit')) || 400);
	try {
		const photos = await listGeneratedPhotos(limit);
		return json({ photos, reviewer: cookies.get(REVIEWER_COOKIE) ?? null });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : 'failed to load photos' }, { status: 500 });
	}
};

// POST — upsert one reviewer's tags for one photo (existing or generated).
export const POST: RequestHandler = async ({ cookies, request }) => {
	if (!tokenIsValid(cookies.get(ADMIN_COOKIE))) {
		return json({ error: 'unauthorized' }, { status: 401 });
	}
	try {
		const body = await request.json();
		const review = await savePhotoReview(body, cookies.get(REVIEWER_COOKIE) ?? null);
		return json({ review });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : 'failed to save review' }, { status: 400 });
	}
};
