import { BLOG_HOSTS } from '$lib/blog/site';
import type { LayoutLoad } from './$types';

// Not prerendered on purpose. Prerendered pages are served by Vercel's static
// layer BEFORE any request reaches the SvelteKit function, which is where the
// `sree.riteangle.dating` -> /blog rewrite lives (src/hooks.ts). Rendering
// through the function keeps the subdomain working; the CDN cache headers set in
// each load give static-like delivery anyway, and Vercel purges that cache on
// every deploy, so a new post is live as soon as it ships.
export const prerender = false;

export const load: LayoutLoad = ({ url }) => {
	return { onBlogHost: BLOG_HOSTS.includes(url.hostname) };
};
