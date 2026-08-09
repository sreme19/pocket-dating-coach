import { error, type Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Per-signed-in-user budget. This is the limit that should normally bite: one
// person hammering the API gets throttled without touching anybody else.
const MAX_REQUESTS_PER_USER = 2000;

// Per-IP backstop for unauthenticated traffic and for abuse that forges or omits
// a token. Deliberately far higher than the per-user budget: mobile carriers
// (and any office WiFi) put hundreds of real users behind ONE public IP via
// CGNAT, so a per-IP budget sized for one person locked out every tester on a
// carrier at once — which is exactly what it did.
const MAX_REQUESTS_PER_IP = 20000;

const requestCounts = new Map<string, { count: number; resetAt: number }>();
let lastSweepAt = 0;

// Drop expired counters so the map can't grow without bound over an instance's
// life. Cheap and amortised — at most once a window.
function sweepExpired(now: number) {
	if (now - lastSweepAt < RATE_LIMIT_WINDOW_MS) return;
	lastSweepAt = now;
	for (const [key, record] of requestCounts) {
		if (now > record.resetAt) requestCounts.delete(key);
	}
}

// The `sub` claim from a Supabase access token, WITHOUT verifying the signature.
// Route handlers do the real auth; this is only used to pick a rate-limit
// bucket, and a forged `sub` still falls under the per-IP backstop below.
function userIdFromAuthHeader(request: Request): string | null {
	const header = request.headers.get('authorization');
	if (!header?.startsWith('Bearer ')) return null;
	const payload = header.slice(7).split('.')[1];
	if (!payload) return null;
	try {
		const json = JSON.parse(
			Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
		);
		const sub = json?.sub;
		return typeof sub === 'string' && sub.length > 0 ? sub : null;
	} catch {
		return null;
	}
}

// Bump `key`'s counter. Returns seconds until reset once over `max`, else null.
function overLimit(key: string, max: number, now: number): number | null {
	const record = requestCounts.get(key);
	if (!record || now > record.resetAt) {
		requestCounts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
		return null;
	}
	record.count++;
	if (record.count > max) return Math.ceil((record.resetAt - now) / 1000);
	return null;
}

// Origins the locally-bundled Capacitor app uses (iOS: capacitor://localhost,
// Android: https://localhost). The bundled SPA calls these API routes
// cross-origin, so they need CORS. Auth is via Authorization: Bearer headers
// (not cookies), so no credentials/cookie allowance is required.
const CAPACITOR_ORIGINS = new Set([
	'capacitor://localhost',
	'https://localhost',
	'ionic://localhost',
	'http://localhost'
]);

function corsHeaders(origin: string): Record<string, string> {
	return {
		'Access-Control-Allow-Origin': origin,
		'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
		'Access-Control-Allow-Headers': 'Authorization, Content-Type',
		'Access-Control-Max-Age': '86400',
		Vary: 'Origin'
	};
}

function getClientIp(request: Request): string {
	return (
		request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
		request.headers.get('x-real-ip') ??
		'unknown'
	);
}

// Hostnames whose /blog/* paths are duplicates of the blog's own subdomain.
const MAIN_SITE_HOSTS = new Set(['riteangle.dating', 'www.riteangle.dating']);

export const handle: Handle = async ({ event, resolve }) => {
	const isApi = event.url.pathname.startsWith('/api/');

	// The personal blog lives on sree.riteangle.dating and nowhere else. `/blog`
	// on the main site is a SEPARATE publication — riteangle's own writing — so
	// the personal routes must not answer here. They are the same SvelteKit
	// routes, so without this guard the main domain serves a second copy of
	// Sree's posts at a URL nothing links to and no canonical tag points at.
	//
	// Deliberately a 404 and NOT a redirect to the subdomain: the two sites are
	// unrelated, and bouncing a reader from one to the other would merge them.
	//
	// Scoped to the production hostnames only, so /blog stays browsable on
	// localhost and on Vercel preview URLs — that is how the blog is written and
	// reviewed before it ships.
	if (
		!isApi &&
		MAIN_SITE_HOSTS.has(event.url.hostname) &&
		(event.url.pathname === '/blog' || event.url.pathname.startsWith('/blog/'))
	) {
		error(404, 'Not found');
	}
	const origin = event.request.headers.get('origin');
	const allowOrigin = origin && CAPACITOR_ORIGINS.has(origin) ? origin : null;

	// Answer the native app's CORS preflight before rate limiting.
	if (isApi && allowOrigin && event.request.method === 'OPTIONS') {
		return new Response(null, { status: 204, headers: corsHeaders(allowOrigin) });
	}

	if (isApi) {
		const ip = getClientIp(event.request);

		// Skip rate limiting for local development
		if (ip !== 'unknown' && ip !== '127.0.0.1' && ip !== '::1') {
			const now = Date.now();
			sweepExpired(now);

			const userId = userIdFromAuthHeader(event.request);
			// A signed-in caller is charged to their own bucket; the IP backstop
			// still applies so one host can't fan out across forged identities.
			const retryAfter =
				(userId ? overLimit(`u:${userId}`, MAX_REQUESTS_PER_USER, now) : null) ??
				overLimit(`ip:${ip}`, MAX_REQUESTS_PER_IP, now);

			if (retryAfter !== null) {
				return new Response(
					JSON.stringify({ error: 'Rate limit exceeded. Try again in an hour.' }),
					{
						status: 429,
						headers: {
							'Content-Type': 'application/json',
							'Retry-After': String(retryAfter),
							...(allowOrigin ? corsHeaders(allowOrigin) : {})
						}
					}
				);
			}
		}
	}

	const response = await resolve(event);

	// Attach CORS headers to API responses for the native app.
	if (isApi && allowOrigin) {
		for (const [key, value] of Object.entries(corsHeaders(allowOrigin))) {
			response.headers.set(key, value);
		}
	}

	return response;
};
