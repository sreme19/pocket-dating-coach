import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { ADMIN_COOKIE, REVIEWER_COOKIE, tokenIsValid } from '$lib/server/admin-auth';

export const load: LayoutServerLoad = async ({ cookies, url }) => {
	// The login page itself must stay reachable while logged out.
	if (url.pathname === '/admin/login') {
		return { reviewer: cookies.get(REVIEWER_COOKIE) ?? null };
	}

	if (!tokenIsValid(cookies.get(ADMIN_COOKIE))) {
		const next = encodeURIComponent(url.pathname + url.search);
		throw redirect(303, `/admin/login?next=${next}`);
	}

	return { reviewer: cookies.get(REVIEWER_COOKIE) ?? null };
};
