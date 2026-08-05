<script lang="ts">
	import { page, navigating } from '$app/stores';
	import { Menu, X } from 'lucide-svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	let onLogin = $derived($page.url.pathname === '/admin/login');
	let mobileOpen = $state(false);

	const links = [
		{ href: '/admin/qa', label: 'QA Queue' },
		{ href: '/admin/qa/voice', label: 'Voice Calls' },
		{ href: '/admin/analytics', label: 'Analytics' },
		{ href: '/admin/features', label: 'Feature Usage' },
		{ href: '/admin/test-suite', label: 'AI Assistants' },
		{ href: '/admin/photos', label: 'AI Photos' },
		{ href: '/admin/gemini', label: 'Gemini Lab' },
		{ href: '/admin/monitoring', label: 'Monitoring' },
		{ href: '/admin/beta', label: 'Beta Invites' },
		{ href: '/admin/logs', label: 'App Logs' }
	];

	// Active link is the single most-specific match so `/admin/qa/results`
	// doesn't also light up `/admin/qa`.
	let activeHref = $derived(
		links
			.filter((l) => $page.url.pathname === l.href || $page.url.pathname.startsWith(l.href + '/'))
			.sort((a, b) => b.href.length - a.href.length)[0]?.href
	);

	// Collapse the mobile menu as soon as a navigation kicks off, so the new
	// page isn't hidden behind an open drawer.
	$effect(() => {
		if ($navigating) mobileOpen = false;
	});
</script>

{#if !onLogin}
	<!-- Navigation progress bar. SvelteKit runs the target page's server `load`
	     before swapping the view; some admin loads take several seconds, which
	     otherwise reads as a frozen, unresponsive click. This gives instant
	     feedback the moment any link is tapped. -->
	{#if $navigating}
		<div class="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-emerald-500/15">
			<div class="admin-nav-bar h-full w-1/3 bg-emerald-400"></div>
		</div>
	{/if}

	<header class="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0b1120]/95 backdrop-blur">
		<div class="flex items-center justify-between px-4 py-3 sm:px-6">
			<span class="text-sm font-bold text-white">PDC Admin</span>

			<!-- Desktop nav -->
			<nav class="hidden items-center gap-1 lg:flex">
				{#each links as l}
					<a
						href={l.href}
						class="rounded px-3 py-1.5 text-sm transition-colors {activeHref === l.href
							? 'bg-emerald-500/20 text-emerald-400'
							: 'text-slate-400 hover:text-slate-200'}">{l.label}</a
					>
				{/each}
			</nav>

			<div class="hidden items-center gap-3 text-xs text-slate-400 lg:flex">
				{#if data.reviewer}<span>Reviewer: <span class="text-slate-200">{data.reviewer}</span></span>{/if}
				<form method="POST" action="/admin/login?/logout">
					<button class="rounded border border-white/[0.1] px-2 py-1 text-slate-400 hover:text-slate-200"
						>Log out</button
					>
				</form>
			</div>

			<!-- Mobile menu toggle -->
			<button
				onclick={() => (mobileOpen = !mobileOpen)}
				aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
				aria-expanded={mobileOpen}
				class="rounded p-1.5 text-slate-300 hover:bg-white/[0.06] lg:hidden"
			>
				{#if mobileOpen}
					<X class="h-5 w-5" />
				{:else}
					<Menu class="h-5 w-5" />
				{/if}
			</button>
		</div>

		<!-- Mobile drawer -->
		{#if mobileOpen}
			<nav class="border-t border-white/[0.06] px-3 py-2 lg:hidden">
				<div class="grid grid-cols-2 gap-1">
					{#each links as l}
						<a
							href={l.href}
							onclick={() => (mobileOpen = false)}
							class="rounded px-3 py-2 text-sm transition-colors {activeHref === l.href
								? 'bg-emerald-500/20 text-emerald-400'
								: 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'}">{l.label}</a
						>
					{/each}
				</div>
				<div class="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-2 text-xs text-slate-400">
					{#if data.reviewer}<span>Reviewer: <span class="text-slate-200">{data.reviewer}</span></span>{:else}<span></span>{/if}
					<form method="POST" action="/admin/login?/logout">
						<button class="rounded border border-white/[0.1] px-2 py-1 text-slate-400 hover:text-slate-200"
							>Log out</button
						>
					</form>
				</div>
			</nav>
		{/if}
	</header>
{/if}

<div class="admin-scope">
	{@render children()}
</div>

<style>
	.admin-nav-bar {
		animation: admin-nav-slide 1.1s ease-in-out infinite;
	}
	@keyframes admin-nav-slide {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(400%);
		}
	}

	/*
	 * Mobile responsiveness for every admin page in one place. Admin pages are
	 * data-dense and full of wide tables; without this they force the whole
	 * document wider than the phone viewport, so the page scrolls sideways and
	 * the right-hand columns (often the only actionable link) sit off-screen.
	 *
	 * Make every admin table a self-contained horizontal scroller: it sizes to
	 * its content but is capped at the width of its container, and scrolls
	 * internally instead of stretching the page. `display: block` is what lets
	 * overflow apply to the table box; rows/cells keep their table layout, so
	 * columns still line up. Pages that already wrap a table in an
	 * overflow-x-auto div keep working — the scroll just happens a level in.
	 */
	.admin-scope :global(table) {
		display: block;
		width: max-content;
		max-width: 100%;
		overflow-x: auto;
	}

	/*
	 * Document-level safety net: no admin page may scroll sideways on a phone.
	 * `clip` (not `hidden`) is deliberate — it prevents horizontal page scroll
	 * without turning the scope into a scroll container, so `position: sticky`
	 * inside pages keeps working. Tables above still scroll internally within
	 * their own box, so this only catches stray wide flex/text rows.
	 */
	.admin-scope {
		overflow-x: clip;
	}
</style>
