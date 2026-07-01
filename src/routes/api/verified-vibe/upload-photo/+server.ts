/**
 * POST /api/verified-vibe/upload-photo
 *
 * Uploads a single profile photo (base64 dataURL) to Supabase Storage and
 * returns its public URL. If the photo is the lead, also updates avatar_url.
 * Already-hosted URLs (e.g. AI fal.ai photos) are returned/stored as-is.
 *
 * Body: { dataUrl?: string; imageUrl?: string; label: string }
 * Response: { url: string }
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';

const MIME_TO_EXT: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/jpg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif'
};

function sanitizeLabel(label: string): string {
	return (label || 'photo').replace(/[^a-z0-9_-]/gi, '_').slice(0, 40);
}

export const POST: RequestHandler = async ({ request }) => {
	try {
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

		const body = await request.json() as { dataUrl?: string; imageUrl?: string; label?: string };
		const label = sanitizeLabel(body.label ?? 'photo');
		const supabase = getSupabase();

		// The profile-photo feature stores a man's raw upload as the AI enhancer's
		// reference (same as onboarding does) — but it is EDIT-ONLY and never
		// presented: it is excluded from every public/display photo set, and (see
		// the avatar mirror below) it must never become his avatar_url. His avatar
		// is only ever the AI lead portrait, set by saveAiPhotos.
		const { data: u } = await supabase
			.from('verified_vibe_users')
			.select('gender')
			.eq('id', user.id)
			.maybeSingle();
		const isMan = (u as { gender?: string } | null)?.gender === 'man';

		let url: string;

		if (body.imageUrl && /^https?:\/\//.test(body.imageUrl)) {
			// Already hosted (AI photo) — keep as-is.
			url = body.imageUrl;
		} else if (body.dataUrl && body.dataUrl.startsWith('data:')) {
			const match = body.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
			if (!match) return json({ error: 'Invalid data URL' }, { status: 400 });

			const mime = match[1];
			const ext = MIME_TO_EXT[mime] ?? 'jpg';
			const buffer = Buffer.from(match[2], 'base64');
			const path = `photos/${user.id}/${label}.${ext}`;

			const { error: uploadErr } = await supabase.storage
				.from('profiles')
				.upload(path, buffer, { contentType: mime, upsert: true });

			if (uploadErr) {
				console.error('Photo storage upload error:', uploadErr);
				return json({ error: 'Failed to upload image' }, { status: 500 });
			}

			const { data: urlData } = supabase.storage.from('profiles').getPublicUrl(path);
			url = `${urlData.publicUrl}?v=${buffer.length}`;
		} else {
			return json({ error: 'Provide dataUrl or imageUrl' }, { status: 400 });
		}

		// If this is the lead photo, mirror it to avatar_url — but NEVER for a man
		// (his raw photo must not be presented anywhere; his avatar is the AI lead).
		if (label === 'lead' && !isMan) {
			await supabase
				.from('verified_vibe_users')
				.update({ avatar_url: url })
				.eq('id', user.id);
		}

		return json({ url });
	} catch (err) {
		console.error('upload-photo error:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
