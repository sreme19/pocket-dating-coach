import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	test: {
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./vitest.setup.ts'],
		alias: {
			$lib: '/src/lib',
			$app: '/src/app'
		},
		pool: 'forks',
		poolOptions: {
			forks: {
				singleFork: true
			}
		}
	}
});
