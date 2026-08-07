/**
 * GET  /api/aibestie/thread   — the landing-page conversation and its bar
 * POST /api/aibestie/thread   — send his message, hand the turn to her Bestie
 *
 * Both authenticate with the provisional visitor's own bearer token, issued by
 * /api/aibestie/start. Everything else — whose thread it is, how many turns he
 * has spent, what the bar reads — is resolved server-side from that identity,
 * so none of it is client-settable.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { waitUntil } from '@vercel/functions';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { loadLpThread, sendLpMessage, type ThreadError } from '$lib/server/aibestie-thread';

// Bestie generation measures ~9s and runs in a waitUntil() after the response is
// flushed. Vercel keeps the function alive only until this maxDuration, and the
// short default would truncate generation before the reply was ever inserted —
// the same failure chat/send hit.
export const config = { maxDuration: 60 };

const STATUS: Record<ThreadError, number> = {
	no_session: 404,
	closed: 409,
	invalid: 400,
	error: 500
};

async function userIdFrom(request: Request): Promise<string | null> {
	const header = request.headers.get('authorization') ?? '';
	const token = header.startsWith('Bearer ') ? header.slice(7) : null;
	if (!token) return null;
	try {
		const client = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
			global: { headers: { Authorization: `Bearer ${token}` } }
		});
		const {
			data: { user }
		} = await client.auth.getUser();
		return user?.id ?? null;
	} catch {
		return null;
	}
}

export const GET: RequestHandler = async ({ request }) => {
	const userId = await userIdFrom(request);
	if (!userId) return json({ error: 'unauthorized' }, { status: 401 });

	const result = await loadLpThread(userId);
	if (!result.ok) return json({ error: result.reason }, { status: STATUS[result.reason] });
	return json(result.thread);
};

export const POST: RequestHandler = async ({ request }) => {
	const userId = await userIdFrom(request);
	if (!userId) return json({ error: 'unauthorized' }, { status: 401 });

	let content = '';
	try {
		({ content } = await request.json());
	} catch {
		return json({ error: 'invalid' }, { status: 400 });
	}

	const result = await sendLpMessage(userId, content);
	if (!result.ok) return json({ error: result.reason }, { status: STATUS[result.reason] });

	// Deliberately not awaited. The page returns immediately and polls GET for her
	// reply, so a cold ad click never watches a spinner for the full round-trip.
	waitUntil(result.generateReply());

	return json(result.sent, { status: 201 });
};
