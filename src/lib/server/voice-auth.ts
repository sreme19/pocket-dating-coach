// ============================================================
// voice-auth.ts — auth helpers shared by the /api/voice/* routes.
//
//  - getUserFromRequest: resolve the calling user from a Supabase Bearer token
//    (same pattern as chat/send/+server.ts), for user-facing endpoints.
//  - verifyWorkerSecret: gate the worker-only callbacks (context / tools /
//    finalize) behind a shared secret, since the off-Vercel agent worker has no
//    Supabase user session.
// ============================================================

import { env } from '$env/dynamic/private';

export async function getUserFromRequest(
	request: Request
): Promise<{ id: string } | null> {
	const authHeader = request.headers.get('authorization') ?? '';
	const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
	if (!token) return null;

	const { createClient } = await import('@supabase/supabase-js');
	const { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } = await import('$env/static/public');
	const userClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		global: { headers: { Authorization: `Bearer ${token}` } }
	});
	const {
		data: { user },
		error
	} = await userClient.auth.getUser();
	if (error || !user?.id) return null;
	return { id: user.id };
}

/** True if the request carries the shared worker secret. */
export function verifyWorkerSecret(request: Request): boolean {
	const expected = env.VOICE_WORKER_SECRET;
	if (!expected) return false;
	const provided = request.headers.get('x-voice-worker-secret');
	return !!provided && provided === expected;
}
