import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';

const BUCKET = 'profile-uploads';
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

function requireSessionId(value: FormDataEntryValue | null): string {
	if (typeof value !== 'string' || value.trim().length < 8) {
		throw error(400, 'sessionId is required');
	}
	return value.trim();
}

function sanitizeFileName(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 80) || 'profile-photo';
}

export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData();
	const sessionId = requireSessionId(formData.get('sessionId'));
	const file = formData.get('file');

	if (!(file instanceof File)) {
		throw error(400, 'file is required');
	}
	if (!file.type.startsWith('image/')) {
		throw error(400, 'Only image uploads are supported');
	}
	if (file.size > MAX_PHOTO_BYTES) {
		throw error(400, 'Image must be smaller than 8MB');
	}

	const supabase = getSupabase();
	const extension = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
	const path = `female-profiles/${sessionId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}.${extension}`;

	try {
		const { error: uploadError } = await supabase.storage
			.from(BUCKET)
			.upload(path, file, {
				contentType: file.type,
				upsert: false
			});

		if (uploadError) throw uploadError;

		const { data: signedData, error: signedError } = await supabase.storage
			.from(BUCKET)
			.createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

		if (signedError) throw signedError;

		return json({
			storagePath: path,
			signedUrl: signedData.signedUrl,
			fileName: file.name
		});
	} catch (err) {
		console.error('[api/female-profile/photo] Upload failed:', err);
		throw error(503, 'Photo storage is temporarily unavailable');
	}
};
