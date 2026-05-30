import type { Handle } from '@sveltejs/kit';

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 500; // per IP per hour — enough for normal app usage

const ipRequestMap = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: Request): string {
	return (
		request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
		request.headers.get('x-real-ip') ??
		'unknown'
	);
}

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/api/')) {
		const ip = getClientIp(event.request);

		// Skip rate limiting for local development
		if (ip === 'unknown' || ip === '127.0.0.1' || ip === '::1') {
			return resolve(event);
		}

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
							'Retry-After': String(Math.ceil((record.resetAt - now) / 1000))
						}
					}
				);
			}
		}
	}

	return resolve(event);
};
