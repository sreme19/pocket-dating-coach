import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	resolve: {
		conditions: ['browser']
	},
	test: {
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./vitest.setup.ts'],
		alias: {
			$lib: '/src/lib',
			'$app/navigation': '/src/app/navigation.ts',
			'$app/stores': '/src/app/stores.ts',
			'$app/environment': '/src/app/environment.ts',
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
