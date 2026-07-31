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
		// '.git/**' matters: a git worktree lives under .git/ and its copy of the
		// tree contains test files. Vitest globs them, then fails to load them
		// because the checkout they belong to has moved on — dozens of phantom
		// failures that have nothing to do with the code under test.
		exclude: ['node_modules', '.claude/**', 'dist', '.svelte-kit', '.git/**'],
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
