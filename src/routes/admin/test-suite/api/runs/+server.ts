import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ADMIN_COOKIE, tokenIsValid } from '$lib/server/admin-auth';
import { listRuns } from '$lib/server/test-suite';

export const GET: RequestHandler = async ({ cookies, url }) => {
	if (!tokenIsValid(cookies.get(ADMIN_COOKIE))) {
		return json({ error: 'unauthorized' }, { status: 401 });
	}
	const limit = Math.min(200, Number(url.searchParams.get('limit')) || 50);
	const runs = await listRuns(limit);
	return json({ runs });
};
