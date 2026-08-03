/**
 * Resolve the caller from their Supabase access token.
 *
 * Several member endpoints took the user's identity from `body.userId` with no
 * verification at all — the doc comments described this as "trusting it for
 * intra-VV requests", but the routes are on the public internet. Anyone could POST
 * an arbitrary id to the advisor chat and read that member's private coaching
 * context: trust score, standing, band, and their matches by name. The same shape
 * also let anyone burn Anthropic credits at will.
 *
 * The rule this establishes: identity comes from the token, never from the body.
 * A body-supplied `userId` is at most a cross-check.
 */

import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

/**
 * The authenticated caller's id, or null when the token is missing or invalid.
 *
 * Verification goes through Supabase with the ANON key and the caller's own bearer
 * token — never the service key, which would bypass the check being made.
 */
export async function resolveUserId(request: Request): Promise<string | null> {
	const header = request.headers.get('authorization') ?? '';
	const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
	if (!token) return null;

	try {
		const client = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
			global: { headers: { Authorization: `Bearer ${token}` } }
		});
		const {
			data: { user },
			error
		} = await client.auth.getUser();
		if (error || !user?.id) return null;
		return user.id;
	} catch {
		// A malformed token is an auth failure, not a 500.
		return null;
	}
}

/**
 * Resolve the caller and reject a mismatched `body.userId`.
 *
 * Clients still send their own id in the body, and that is fine — but if it
 * disagrees with the token, something is wrong (a stale session, or someone
 * probing for another member's data), so refuse rather than quietly preferring
 * one. The token always wins when they agree.
 */
export function reconcileBodyUserId(
	authedUserId: string,
	bodyUserId: string | undefined | null
): { ok: true; userId: string } | { ok: false; reason: string } {
	const claimed = (bodyUserId ?? '').trim();
	if (claimed && claimed !== authedUserId) {
		return { ok: false, reason: 'userId does not match the authenticated user' };
	}
	return { ok: true, userId: authedUserId };
}
