/**
 * POST /api/aibestie/start
 *
 * Opens a landing-page conversation: mints a provisional visitor, a thread
 * against the configured owner, and the credentials to log in as him.
 *
 * Unauthenticated by design — the caller is an anonymous ad click, and issuing
 * him an identity is the entire job. Everything that makes that safe lives one
 * layer down in aibestie-session.ts: the gate, the roster check, and the per-
 * origin rate limit that stops a bot turning a public Claude endpoint into an
 * open invoice.
 *
 * Response (200):
 *   { matchId, ownerId, claimCode, auth: { email, otp } }
 *
 * The client exchanges `auth` via supabase.auth.verifyOtp to obtain a session,
 * exactly as the seed-login flow does. The OTP is safe to hand over: it belongs
 * to a throwaway account created moments ago for this browser and nothing else.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { startLpSession, lpEnabled, type StartFailure } from '$lib/server/aibestie-session';

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
 * Cheap readiness probe, so the page can render a configured/not-configured state
 * without minting anybody. Deliberately says nothing about WHO the owner is.
 */
export const GET: RequestHandler = async () => json({ enabled: lpEnabled() });

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
			matchId: session.matchId,
			ownerId: session.ownerId,
			claimCode: session.claimCode,
			auth: { email: session.email, otp: session.otp }
		},
		{ status: 201 }
	);
};
