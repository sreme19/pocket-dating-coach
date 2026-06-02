import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ADMIN_COOKIE, tokenIsValid } from '$lib/server/admin-auth';
import { warmMatrix } from '$lib/server/test-suite';

export const POST: RequestHandler = async ({ cookies }) => {
	if (!tokenIsValid(cookies.get(ADMIN_COOKIE))) {
		return json({ error: 'unauthorized' }, { status: 401 });
	}
	try {
		const result = await warmMatrix();
		return json(result);
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : 'warm-matrix failed' }, { status: 500 });
	}
};
