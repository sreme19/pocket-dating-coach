// Identity and canonical origin for the personal blog.
//
// This is Sree's own writing, hosted on a subdomain of a domain he owns. It is
// deliberately NOT riteangle product surface: separate origin, separate look,
// its own feed. The only tie is one link back to the app.

export const BLOG_NAME = 'Sree Dayanidhi';

export const BLOG_TAGLINE = 'Notes on agentic systems, operations, and building riteangle.';

/**
 * Canonical origin. Every absolute URL the blog emits — canonical tags, OG
 * urls, RSS links, sitemap entries — is built from this, so search engines and
 * feed readers only ever see one hostname for a given post.
 */
export const BLOG_ORIGIN = 'https://sree.riteangle.dating';

/** Hostnames that should serve the blog at their root. */
export const BLOG_HOSTS = [
	'sree.riteangle.dating',
	// Local development: add `127.0.0.1 sree.localhost` to /etc/hosts to
	// exercise the subdomain rewrite, or just browse /blog directly.
	'sree.localhost'
];

/** Fallback share card for posts with no `cover:` of their own. */
export const BLOG_DEFAULT_COVER = '/og/riteangle-logo.png';

/**
 * Where replies go. This blog has no comment system on purpose: a comment box
 * is a moderation queue, a spam surface, and a store of other people's personal
 * data, and none of those are worth owning on a site whose subject matter
 * already attracts drive-by abuse. Discussion happens on LinkedIn instead,
 * where the audience already is and where the moderation is someone else's
 * problem.
 */
export const BLOG_LINKEDIN = 'https://www.linkedin.com/in/sreekanthdayanidhi/';

/**
 * Blog pages are pure build-output: they change only when a deploy ships new
 * markdown. So the browser revalidates every time (max-age=0) while Vercel's CDN
 * serves a cached copy for an hour and keeps serving a stale one for a day while
 * it refreshes in the background. A deploy purges the CDN, so publishing is
 * still instant.
 */
export const BLOG_CACHE_CONTROL =
	'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

export function absolute(path: string): string {
	return new URL(path, BLOG_ORIGIN).toString();
}

/**
 * Internal href for a blog path.
 *
 * On a blog host the posts live at the root (`/my-post`), because the subdomain
 * IS the blog. Everywhere else — localhost, Vercel preview URLs, the main
 * domain — the same pages are reachable under `/blog`. Both forms resolve to the
 * same route; only one of them is ever canonical (see `absolute`).
 *
 * @param path leading-slash path relative to the blog root, `''` for the index.
 */
export function blogHref(onBlogHost: boolean, path = ''): string {
	const clean = path === '/' ? '' : path;
	if (onBlogHost) return clean || '/';
	return `/blog${clean}`;
}

/** Human-readable tag label, e.g. "agentic-architecture" -> "Agentic architecture". */
export function tagLabel(tag: string): string {
	const spaced = tag.replace(/-/g, ' ');
	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function formatDate(date: string): string {
	// Parsed as UTC on purpose: a bare YYYY-MM-DD must not shift a day
	// backwards for readers west of Greenwich.
	return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		timeZone: 'UTC'
	});
}
