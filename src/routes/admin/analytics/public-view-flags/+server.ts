/**
 * POST /admin/analytics/public-view-flags
 *   Returns the AI Bestie flags for a male profile so an admin can preview the
 *   public profile "as a woman would see it".
 *
 *   Body (JSON): { profileId: string }
 *   Response: { flags: Array<{ level: 'orange' | 'red', title: string, detail: string }> }
 *
 * Auth: admin session cookie (pdc_admin). This route lives under /admin so the
 * path-scoped admin cookie is sent with the request — even when the fetch is
 * initiated from the /verified-vibe/profile preview page (cookie path matches
 * the REQUEST url, not the initiating page). +server.ts handlers don't run the
 * layout load, so the token is validated explicitly here.
 *
 * Flag generation + caching are shared with the member API via generateBestieFlags().
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ADMIN_COOKIE, tokenIsValid } from '$lib/server/admin-auth';
import { generateBestieFlags } from '$lib/server/bestie-flags';

export const POST: RequestHandler = async ({ request, cookies }) => {
	if (!tokenIsValid(cookies.get(ADMIN_COOKIE))) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	let profileId: unknown;
	try {
		({ profileId } = await request.json());
	} catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}
	if (typeof profileId !== 'string' || !profileId) {
		return json({ error: 'profileId is required' }, { status: 400 });
	}

	try {
		const flags = await generateBestieFlags(profileId);
		return json({ flags });
	} catch (err) {
		console.error('public-view-flags error:', err);
		return json({ flags: [] });
	}
};
