/**
 * POST /api/aibestie/claim   { code }
 *
 * Hands a landing-page conversation to the account he just signed up with.
 *
 * Auth is his REAL Supabase session — the one the app creates at signup — because
 * the whole point is to prove who is inheriting the thread. The landing page's own
 * opaque token is deliberately NOT accepted: it identifies the anonymous visitor,
 * which is the side of the transfer we already know.
 *
 * Two routes reach this, and both may fire for the same install:
 *   · the Play install referrer, which carries ra_claim and is readable once;
 *   · the visible code on the page, typed by hand — the fallback that survives a
 *     manual store search and works on iOS.
 * The claim is idempotent on claimed_at, so the second one is refused rather than
 * re-run.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { waitUntil } from '@vercel/functions';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { claimLpSession, foldTranscriptIntoProfile, type ClaimFailure } from '$lib/server/aibestie-claim';

// foldTranscriptIntoProfile runs a Claude call in a waitUntil() after the response
// is flushed; the short default would cut it off mid-flight.
export const config = { maxDuration: 60 };

const STATUS: Record<ClaimFailure, number> = {
	not_found: 404,
	already_claimed: 409,
	nothing_to_claim: 404,
	wrong_gender: 403,
	conflict: 409,
	error: 500
};

/** Human-readable, because the app shows these to someone typing a code by hand. */
const MESSAGE: Record<ClaimFailure, string> = {
	not_found: "That code doesn't match a conversation.",
	already_claimed: 'That conversation has already been added to an account.',
	nothing_to_claim: "There's no conversation saved against that code.",
	wrong_gender: "That conversation can't be added to this account.",
	conflict: "You're already talking to her — check your chats.",
	error: 'Something went wrong. Try again in a moment.'
};

export const POST: RequestHandler = async ({ request }) => {
	const header = request.headers.get('authorization') ?? '';
	const token = header.startsWith('Bearer ') ? header.slice(7) : null;
	if (!token) return json({ error: 'unauthorized' }, { status: 401 });

	let userId: string;
	try {
		const client = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
			global: { headers: { Authorization: `Bearer ${token}` } }
		});
		const {
			data: { user }
		} = await client.auth.getUser();
		if (!user?.id) return json({ error: 'unauthorized' }, { status: 401 });
		userId = user.id;
	} catch {
		return json({ error: 'unauthorized' }, { status: 401 });
	}

	let code = '';
	try {
		({ code } = await request.json());
	} catch {
		return json({ error: 'invalid', message: 'Missing code.' }, { status: 400 });
	}

	const result = await claimLpSession(code, userId);
	if (!result.ok) {
		return json(
			{ error: result.reason, message: MESSAGE[result.reason] },
			{ status: STATUS[result.reason] }
		);
	}

	// Everything he said on the landing page folds into his vectors now — once, over
	// the whole transcript, rather than per message during the conversation. See
	// aibestie-claim.ts for why that ordering matters to his progress bar.
	waitUntil(foldTranscriptIntoProfile(result.result.matchId, userId));

	return json(result.result);
};
