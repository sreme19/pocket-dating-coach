import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Force-load .env.local values, overriding any shell env vars that might be empty.
// Needed because Claude Code agent sets ANTHROPIC_API_KEY="" which Vite normally respects.
function forceLoadEnvLocal() {
  const envLocalPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envLocalPath)) return;
  const content = readFileSync(envLocalPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim();
    if (key && val) {
      process.env[key] = val;
    }
  }
}
forceLoadEnvLocal();

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		fs: {
			// Allow serving files from the parent node_modules (git worktree setup)
			// Worktree is 3 levels deep: .claude/worktrees/objective-shaw-f9cdf9
			allow: ['..', '../..', '../../..']
		},
		allowedHosts: [
			'localhost',
			'127.0.0.1',
			'pocket-dating-coach-demo.loca.lt'
		]
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
