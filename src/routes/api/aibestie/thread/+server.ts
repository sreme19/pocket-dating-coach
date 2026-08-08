/**
 * GET  /api/aibestie/thread   — the landing-page conversation and its bar
 * POST /api/aibestie/thread   — send his message, hand the turn to her Bestie
 *
 * Both authenticate with the OPAQUE session token issued by /api/aibestie/start.
 * Everything else — whose thread it is, how many turns he has spent, what the bar
 * reads — is resolved server-side from that token, so none of it is
 * client-settable.
 *
 * POST is also where a visitor first becomes rows: the profile, the match and her
 * opener are written on his first message and not before.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { waitUntil } from '@vercel/functions';
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

/**
 * The visitor's OPAQUE session token. Not a Supabase JWT: no auth user exists
 * until he signs up, and these routes are the only thing he ever calls.
 */
function tokenFrom(request: Request): string | null {
	const header = request.headers.get('authorization') ?? '';
	return header.startsWith('Bearer ') ? header.slice(7) : null;
}

export const GET: RequestHandler = async ({ request }) => {
	const token = tokenFrom(request);
	if (!token) return json({ error: 'unauthorized' }, { status: 401 });

	const result = await loadLpThread(token);
	if (!result.ok) return json({ error: result.reason }, { status: STATUS[result.reason] });
	return json(result.thread);
};

export const POST: RequestHandler = async ({ request }) => {
	const token = tokenFrom(request);
	if (!token) return json({ error: 'unauthorized' }, { status: 401 });

	let content = '';
	try {
		({ content } = await request.json());
	} catch {
		return json({ error: 'invalid' }, { status: 400 });
	}

	const result = await sendLpMessage(token, content);
	if (!result.ok) return json({ error: result.reason }, { status: STATUS[result.reason] });

	// Deliberately not awaited. The page returns immediately and polls GET for her
	// reply, so a cold ad click never watches a spinner for the full round-trip.
	waitUntil(result.generateReply());

	return json(result.sent, { status: 201 });
};
