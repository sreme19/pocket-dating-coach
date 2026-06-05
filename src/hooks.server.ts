import type { Handle } from '@sveltejs/kit';

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 500; // per IP per hour — enough for normal app usage

const ipRequestMap = new Map<string, { count: number; resetAt: number }>();

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

export const handle: Handle = async ({ event, resolve }) => {
	const isApi = event.url.pathname.startsWith('/api/');
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
			const record = ipRequestMap.get(ip);

			if (!record || now > record.resetAt) {
				ipRequestMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
			} else {
				record.count++;
				if (record.count > MAX_REQUESTS) {
					return new Response(
						JSON.stringify({ error: 'Rate limit exceeded. Try again in an hour.' }),
						{
							status: 429,
							headers: {
								'Content-Type': 'application/json',
								'Retry-After': String(Math.ceil((record.resetAt - now) / 1000)),
								...(allowOrigin ? corsHeaders(allowOrigin) : {})
							}
						}
					);
				}
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
