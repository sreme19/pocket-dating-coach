/**
 * Admin / QA access gate.
 *
 * The /admin tree (analytics + QA console) is protected by a single shared
 * password (env QA_ADMIN_PASSWORD) rather than per-user app auth — interns get
 * the password, not a full app account. A signed cookie keeps them logged in.
 *
 * The cookie value is an HMAC of a constant keyed by the password, so it can be
 * verified statelessly and is invalidated automatically if the password changes.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

export const ADMIN_COOKIE = 'pdc_admin';
export const REVIEWER_COOKIE = 'pdc_reviewer';

const COOKIE_PAYLOAD = 'pdc-admin-v1';

function adminPassword(): string | null {
	const pw = env.QA_ADMIN_PASSWORD;
	return pw && pw.length > 0 ? pw : null;
}

/** Token written to the cookie once the password is verified. */
export function makeAdminToken(): string {
	const pw = adminPassword();
	if (!pw) throw new Error('QA_ADMIN_PASSWORD is not configured');
	return createHmac('sha256', pw).update(COOKIE_PAYLOAD).digest('base64url');
}

/** Constant-time check of a submitted password against the configured one. */
export function passwordMatches(submitted: string): boolean {
	const pw = adminPassword();
	if (!pw) return false;
	const a = Buffer.from(submitted);
	const b = Buffer.from(pw);
	if (a.length !== b.length) return false;
	return timingSafeEqual(a, b);
}

/** Validate a cookie token previously issued by makeAdminToken(). */
export function tokenIsValid(token: string | undefined): boolean {
	if (!token || !adminPassword()) return false;
	let expected: string;
	try {
		expected = makeAdminToken();
	} catch {
		return false;
	}
	const a = Buffer.from(token);
	const b = Buffer.from(expected);
	if (a.length !== b.length) return false;
	return timingSafeEqual(a, b);
}

export function adminAuthConfigured(): boolean {
	return adminPassword() !== null;
}

export const ADMIN_COOKIE_OPTS = {
	path: '/admin',
	httpOnly: true,
	sameSite: 'lax' as const,
	secure: true,
	maxAge: 60 * 60 * 12 // 12h shift
};
