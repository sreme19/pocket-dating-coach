import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ADMIN_COOKIE, REVIEWER_COOKIE, tokenIsValid } from '$lib/server/admin-auth';
import { runMatchmaker } from '$lib/server/test-suite';

export const POST: RequestHandler = async ({ request, cookies }) => {
	if (!tokenIsValid(cookies.get(ADMIN_COOKIE))) {
		return json({ error: 'unauthorized' }, { status: 401 });
	}
	try {
		const { maleId, femaleId, persist } = (await request.json()) as {
			maleId?: string;
			femaleId?: string;
			persist?: boolean;
		};
		if (!maleId || !femaleId) {
			return json({ error: 'maleId and femaleId are required' }, { status: 400 });
		}
		const result = await runMatchmaker(maleId, femaleId, {
			persist: !!persist,
			reviewer: cookies.get(REVIEWER_COOKIE) ?? null
		});
		return json(result);
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : 'matchmaker run failed' }, { status: 500 });
	}
};
