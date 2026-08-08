import type { Reroute } from '@sveltejs/kit';
import { BLOG_HOSTS } from '$lib/blog/site';

// Serves the personal blog at the ROOT of its own hostname while the routes
// themselves live under src/routes/blog. On sree.riteangle.dating a request for
// `/my-post` is routed as `/blog/my-post`; the visitor never sees `/blog` in the
// URL, and the app's own routes are untouched on every other hostname.
//
// This runs for both server requests and client-side navigations, so an internal
// link resolves the same way on a cold load and after hydration.

export const reroute: Reroute = ({ url }) => {
	if (!BLOG_HOSTS.includes(url.hostname)) return;

	const { pathname } = url;

	// Already canonical — leave it be, so /blog/x keeps working on this host too.
	if (pathname === '/blog' || pathname.startsWith('/blog/')) return;

	// Never rewrite the API or SvelteKit's own asset paths.
	if (pathname.startsWith('/api/') || pathname.startsWith('/_app/')) return;

	// Anything with a file extension is a static asset and is served as-is. The
	// exception is .xml, which is how the feed and sitemap are addressed.
	if (/\.[a-z0-9]+$/i.test(pathname) && !/\.xml$/i.test(pathname)) return;

	return pathname === '/' ? '/blog' : `/blog${pathname}`;
};
