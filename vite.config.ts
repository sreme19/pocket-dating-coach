import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		fs: {
			// Allow serving files from the parent node_modules (git worktree setup)
			// Worktree is 3 levels deep: .claude/worktrees/objective-shaw-f9cdf9
			allow: ['..', '../..', '../../..']
		}
	},
	build: {
		// Code splitting configuration
		rollupOptions: {
			output: {
				manualChunks: (id) => {
					// Split vendor libraries
					if (id.includes('@anthropic-ai/sdk')) {
						return 'vendor-anthropic';
					}
					if (id.includes('@supabase/supabase-js')) {
						return 'vendor-supabase';
					}
if (id.includes('lucide-svelte')) {
						return 'vendor-lucide';
					}
					// Split verified-vibe features
					if (id.includes('VerificationStep') || id.includes('LivenessStep') || id.includes('PhotoUploadStep')) {
						return 'verified-vibe-verification';
					}
					if (id.includes('UserProfileCard') || id.includes('DiscoveryFeed')) {
						return 'verified-vibe-discovery';
					}
					if (id.includes('ChatInterface') || id.includes('ChatList')) {
						return 'verified-vibe-chat';
					}
				}
			}
		},
		// Optimize chunk size
		chunkSizeWarningLimit: 500
	},
	// Optimize dependencies
	optimizeDeps: {
		include: [
			'@anthropic-ai/sdk',
			'@supabase/supabase-js',
			'lucide-svelte',
			'clsx',
			'tailwind-merge'
		]
	}
});
