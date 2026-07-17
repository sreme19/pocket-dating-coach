/**
 * POST /api/verified-vibe/bestie-profile-flags
 *
 * AI Bestie profile analysis — only for authenticated female users viewing a male profile.
 * Returns orange/red flags based on inconsistencies between what the profile claims and
 * what was actually verified (e.g., "globe-trotter" label but only 1 travel location uploaded).
 *
 * Body: { profileId: string }
 * Response: { flags: Array<{ level: 'orange' | 'red', title: string, detail: string }> }
 *
 * The flags depend only on the man's data (not the viewer), so generation + caching
 * live in the shared generateBestieFlags() helper. This route just enforces the
 * viewer gate (logged-in woman). The admin public-view preview reuses the same
 * helper behind an admin-cookie gate.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import { generateBestieFlags } from '$lib/server/bestie-flags';

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Auth — only logged-in female users
		const authHeader = request.headers.get('Authorization');
		const token = authHeader?.replace('Bearer ', '');
		if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

		const sb = getSupabase();
		const { data: { user: viewer }, error: authErr } = await sb.auth.getUser(token);
		if (authErr || !viewer) return json({ error: 'Unauthorized' }, { status: 401 });

		// Check viewer is female
		const { data: viewerProfile } = await (sb as any)
			.from('verified_vibe_users')
			.select('gender')
			.eq('id', viewer.id)
			.single();
		if (viewerProfile?.gender !== 'woman') {
			return json({ flags: [] });
		}

		const body = await request.json() as { profileId?: string };
		const profileId = body.profileId;
		if (!profileId) return json({ error: 'profileId required' }, { status: 400 });

		const flags = await generateBestieFlags(profileId);
		return json({ flags });
	} catch (err) {
		console.error('bestie-profile-flags error:', err);
		return json({ flags: [] });
	}
};
