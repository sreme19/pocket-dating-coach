import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// A root catch-all that exists for ONE reason: to make the blog's subdomain work.
//
// adapter-vercel enumerates a route pattern per app route at build time. Anything
// matching none of them is handed to the adapter's own error-only catch-all, which
// renders the 404 page — the `reroute` hook in src/hooks.ts never gets a chance to
// run. That is why `sree.riteangle.dating/` worked (`/` is an enumerated route)
// while `sree.riteangle.dating/hello` 404'd.
//
// Declaring this rest route makes Vercel emit a pattern that matches those bare
// paths, so the request reaches the SvelteKit function, `reroute` rewrites
// `/hello` to `/blog/hello`, and the real blog route renders it. On a blog host
// this component is therefore never rendered — reroute redirects the match away
// before it is reached.
//
// SvelteKit sorts specific routes ahead of rest routes, so nothing else changes:
// every existing page and endpoint still wins its own URL. For any other host an
// unmatched path 404s exactly as before — it already reached a function and
// rendered SvelteKit's error page, so this only makes that explicit.
export const load: PageServerLoad = () => {
	error(404, 'Not found');
};
