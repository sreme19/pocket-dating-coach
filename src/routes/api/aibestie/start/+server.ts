/**
 * POST /api/aibestie/start
 *
 * Opens a landing-page conversation.
 *
 * Writes exactly ONE row and creates no identity. The profile, the match and the
 * messages appear on his FIRST MESSAGE — see aibestie-session.ts — so a visitor
 * who reads her opener and leaves costs a single narrow row.
 *
 * Unauthenticated by design — the caller is an anonymous ad click, and issuing
 * him an identity is the entire job. Everything that makes that safe lives one
 * layer down in aibestie-session.ts: the gate, the roster check, and the per-
 * origin rate limit that stops a bot turning a public Claude endpoint into an
 * open invoice.
 *
 * Response (201):
 *   { token, ownerId, claimCode, owner, opener }
 *
 * `token` is an OPAQUE bearer for /api/aibestie/* — not a Supabase JWT, because
 * no auth user exists yet and none is created until he signs up. `owner` and
 * `opener` let the page paint the whole conversation without a second call, and
 * without anything but this session row being written.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { startLpSession, lpEnabled, type StartFailure } from '$lib/server/aibestie-session';
import { pickOwner, terminusMode } from '$lib/server/aibestie-owner';

/** Only utm_* is forwarded — the landing URL is attacker-controlled. */
function utmFrom(url: URL): Record<string, string> | null {
	const out: Record<string, string> = {};
	for (const [k, v] of url.searchParams) {
		if (k.startsWith('utm_') && v) out[k.slice(0, 40)] = v.slice(0, 200);
	}
	return Object.keys(out).length > 0 ? out : null;
}

const STATUS: Record<StartFailure, number> = {
	disabled: 503,
	rate_limited: 429,
	owner_invalid: 503,
	error: 500
};

/**
 * Cheap readiness probe, so the page can render its gate without minting anybody.
 *
 * It also carries the terminus mode, because the AGE GATE makes a claim before a
 * session exists and therefore before `thread.terminus` is available. The first
 * version of the gate hardcoded "the woman whose profile it is reads these
 * herself" — false for an unstaffed owner, and exactly the claim terminusMode()
 * exists to prevent, reintroduced as page copy. Any surface that describes her
 * has to ask.
 *
 * Deliberately says nothing about WHO the owner is — only whether someone is
 * behind the profile.
 */
export const GET: RequestHandler = async () =>
	json({ enabled: lpEnabled(), terminus: terminusMode(pickOwner()) });

export const POST: RequestHandler = async ({ request, url, getClientAddress }) => {
	let ip: string | null = null;
	try {
		ip = getClientAddress();
	} catch {
		// Local dev and some runtimes have no address to report. Rate limiting then
		// has nothing to key on, which is a weaker posture but not a reason to
		// refuse traffic — the turn cap still bounds each conversation.
		ip = null;
	}

	const result = await startLpSession({
		ip,
		userAgent: request.headers.get('user-agent'),
		utm: utmFrom(url)
	});

	if (!result.ok) {
		return json({ error: result.reason }, { status: STATUS[result.reason] });
	}

	const { session } = result;
	return json(
		{
			token: session.token,
			ownerId: session.ownerId,
			claimCode: session.claimCode,
			owner: session.owner,
			opener: session.opener
		},
		{ status: 201 }
	);
};
