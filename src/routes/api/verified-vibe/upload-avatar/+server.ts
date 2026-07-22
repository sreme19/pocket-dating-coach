/**
 * POST /api/verified-vibe/upload-avatar
 *
 * Uploads a profile/lead photo to Supabase Storage (profiles bucket) and writes
 * the resulting public URL to verified_vibe_users.avatar_url. Replaces the old
 * pattern of storing raw base64 dataURLs directly in the DB column.
 *
 * Accepts either:
 *   { dataUrl: "data:image/jpeg;base64,..." }   — a base64 data URL, or
 *   { imageUrl: "https://..." }                 — an already-hosted URL (e.g. fal.ai
 *                                                  AI photo) which is simply stored as-is
 *
 * Response: { avatarUrl: string }
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import { captureUploads } from '$lib/server/upload-audit';

const MIME_TO_EXT: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/jpg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif'
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		// ── Auth ────────────────────────────────────────────────────────────
		const authHeader = request.headers.get('authorization') ?? '';
		const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
		if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

		const { createClient } = await import('@supabase/supabase-js');
		const { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } = await import('$env/static/public');
		const userClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
			global: { headers: { Authorization: `Bearer ${token}` } }
		});
		const { data: { user }, error: userErr } = await userClient.auth.getUser();
		if (userErr || !user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

		const body = await request.json() as { dataUrl?: string; imageUrl?: string };
		const supabase = getSupabase();

		let avatarUrl: string;

		if (body.imageUrl && /^https?:\/\//.test(body.imageUrl)) {
			// Already hosted (e.g. an AI-generated fal.ai photo) — store the URL directly.
			avatarUrl = body.imageUrl;
		} else if (body.dataUrl && body.dataUrl.startsWith('data:')) {
			// Parse the data URL: data:<mime>;base64,<payload>
			const match = body.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
			if (!match) return json({ error: 'Invalid data URL' }, { status: 400 });

			const mime = match[1];
			const ext = MIME_TO_EXT[mime] ?? 'jpg';
			const buffer = Buffer.from(match[2], 'base64');

			// Stable path so re-uploads overwrite the same object (upsert).
			const path = `avatars/${user.id}/lead.${ext}`;

			const { error: uploadErr } = await supabase.storage
				.from('profiles')
				.upload(path, buffer, { contentType: mime, upsert: true });

			if (uploadErr) {
				console.error('Avatar storage upload error:', uploadErr);
				return json({ error: 'Failed to upload image' }, { status: 500 });
			}

			const { data: urlData } = supabase.storage.from('profiles').getPublicUrl(path);
			// Cache-bust so the CDN serves the new image after an overwrite.
			avatarUrl = `${urlData.publicUrl}?v=${buffer.length}`;

			// Admin-review capture — reference the stored avatar (no re-upload).
			await captureUploads({
				userId: user.id,
				source: 'profile-photo',
				category: 'avatar',
				items: [{ existingUrl: avatarUrl, name: `lead.${ext}`, mimeType: mime, sizeBytes: buffer.length }],
			});
		} else {
			return json({ error: 'Provide dataUrl or imageUrl' }, { status: 400 });
		}

		// Persist to the profile row.
		const { error: updateErr } = await supabase
			.from('verified_vibe_users')
			.update({ avatar_url: avatarUrl })
			.eq('id', user.id);

		if (updateErr) {
			console.error('Avatar DB update error:', updateErr);
			return json({ error: 'Failed to save avatar' }, { status: 500 });
		}

		return json({ avatarUrl });
	} catch (err) {
		console.error('upload-avatar error:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
