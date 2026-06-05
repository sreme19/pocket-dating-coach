import adapterVercel from '@sveltejs/adapter-vercel';
import adapterStatic from '@sveltejs/adapter-static';

// MOBILE_BUILD=true produces a client-rendered SPA (adapter-static) to bundle
// inside the Capacitor app; it calls the API remotely on Vercel. The default
// (web) build stays on adapter-vercel — SSR + API routes + admin — unchanged.
const MOBILE = process.env.MOBILE_BUILD === 'true';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	onwarn: (warning, handler) => {
		// Suppress a11y warnings for interactive card patterns that use non-semantic
		// elements with keyboard handlers (e.g. swipeable discovery cards).
		if (
			warning.code === 'a11y_no_noninteractive_tabindex' ||
			warning.code === 'a11y_no_noninteractive_element_interactions'
		) {
			return;
		}
		handler(warning);
	},
	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: MOBILE
			? adapterStatic({ fallback: 'index.html', strict: false })
			: adapterVercel({
					runtime: 'nodejs22.x'
				})
	}
};

export default config;
