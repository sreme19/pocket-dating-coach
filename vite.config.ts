import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
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
					if (id.includes('@xenova/transformers')) {
						return 'vendor-transformers';
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
