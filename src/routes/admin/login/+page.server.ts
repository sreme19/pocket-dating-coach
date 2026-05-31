import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import {
	ADMIN_COOKIE,
	REVIEWER_COOKIE,
	ADMIN_COOKIE_OPTS,
	makeAdminToken,
	passwordMatches,
	adminAuthConfigured
} from '$lib/server/admin-auth';

function safeNext(next: FormDataEntryValue | null): string {
	const n = typeof next === 'string' ? next : '';
	// Only allow internal admin paths — never an open redirect.
	return n.startsWith('/admin') ? n : '/admin/qa';
}

export const actions: Actions = {
	login: async ({ request, cookies }) => {
		if (!adminAuthConfigured()) {
			return fail(500, { error: 'Admin access is not configured (QA_ADMIN_PASSWORD missing).' });
		}

		const form = await request.formData();
		const password = String(form.get('password') ?? '');
		const reviewer = String(form.get('reviewer') ?? '').trim();
		const next = safeNext(form.get('next'));

		if (!reviewer) {
			return fail(400, { error: 'Enter your name so reviews can be attributed.' });
		}
		if (!passwordMatches(password)) {
			return fail(401, { error: 'Incorrect password.' });
		}

		cookies.set(ADMIN_COOKIE, makeAdminToken(), ADMIN_COOKIE_OPTS);
		cookies.set(REVIEWER_COOKIE, reviewer, { ...ADMIN_COOKIE_OPTS, httpOnly: false });
		throw redirect(303, next);
	},

	logout: async ({ cookies }) => {
		cookies.delete(ADMIN_COOKIE, { path: '/admin' });
		cookies.delete(REVIEWER_COOKIE, { path: '/admin' });
		throw redirect(303, '/admin/login');
	}
};
