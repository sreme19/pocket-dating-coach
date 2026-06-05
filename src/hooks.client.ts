import { Capacitor } from '@capacitor/core';
import { env } from '$env/dynamic/public';

/**
 * Native API-origin rewrite.
 *
 * The mobile app is a locally-bundled SPA (origin `capacitor://localhost` on
 * iOS, `https://localhost` on Android), but the API routes live remotely on
 * Vercel. Client code calls them with relative paths like `fetch('/api/...')`,
 * which only worked when the WebView was pointed at the Vercel origin. Inside
 * the bundled app those relative paths would resolve to the local origin and
 * 404, so we rewrite any `/api/...` request to the configured remote base.
 *
 * This patches the global `fetch` once at client startup, covering every call
 * site (string, URL, or Request) without touching the ~111 individual fetches.
 * No-op on web (PUBLIC_API_BASE_URL is empty there) and off-platform.
 */
const API_BASE = (env.PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');

// Local app origins a relative `/api` path resolves against inside the WebView.
const LOCAL_ORIGINS = new Set([
	'capacitor://localhost',
	'https://localhost',
	'ionic://localhost',
	'http://localhost'
]);

function rewrite(pathAndQuery: string): string {
	return API_BASE + pathAndQuery;
}

if (API_BASE && Capacitor.isNativePlatform() && typeof globalThis.fetch === 'function') {
	const originalFetch = globalThis.fetch.bind(globalThis);

	globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		try {
			// Plain relative string: fetch('/api/...')
			if (typeof input === 'string' && input.startsWith('/api/')) {
				return originalFetch(rewrite(input), init);
			}

			// URL object pointing at the local app origin
			if (input instanceof URL) {
				if (input.pathname.startsWith('/api/') && LOCAL_ORIGINS.has(input.origin)) {
					return originalFetch(rewrite(input.pathname + input.search), init);
				}
			}

			// Request object (relative URLs are resolved to the local origin)
			else if (typeof Request !== 'undefined' && input instanceof Request) {
				const u = new URL(input.url);
				if (u.pathname.startsWith('/api/') && LOCAL_ORIGINS.has(u.origin)) {
					// Re-create the Request against the remote URL, preserving method/headers/body.
					return originalFetch(new Request(rewrite(u.pathname + u.search), input), init);
				}
			}
		} catch {
			/* fall through to the original fetch on any parsing error */
		}
		return originalFetch(input as RequestInfo | URL, init);
	}) as typeof globalThis.fetch;
}
