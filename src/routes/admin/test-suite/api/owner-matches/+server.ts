import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ADMIN_COOKIE, tokenIsValid } from '$lib/server/admin-auth';
import { listOwnerMatches } from '$lib/server/test-suite';

export const GET: RequestHandler = async ({ url, cookies }) => {
	if (!tokenIsValid(cookies.get(ADMIN_COOKIE))) {
		return json({ error: 'unauthorized' }, { status: 401 });
	}
	const ownerId = url.searchParams.get('ownerId');
	if (!ownerId) {
		return json({ error: 'ownerId is required' }, { status: 400 });
	}
	try {
		const matches = await listOwnerMatches(ownerId);
		return json({ matches });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : 'owner-matches failed' }, { status: 500 });
	}
};
