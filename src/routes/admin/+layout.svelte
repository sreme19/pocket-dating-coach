<script lang="ts">
	import { page } from '$app/stores';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	let onLogin = $derived($page.url.pathname === '/admin/login');

	const links = [
		{ href: '/admin/qa', label: 'QA Queue' },
		{ href: '/admin/qa/results', label: 'QA Results' },
		{ href: '/admin/analytics', label: 'Analytics' },
		{ href: '/admin/test-suite', label: 'Test Suite' }
	];

	// Active link is the single most-specific match so `/admin/qa/results`
	// doesn't also light up `/admin/qa`.
	let activeHref = $derived(
		links
			.filter((l) => $page.url.pathname === l.href || $page.url.pathname.startsWith(l.href + '/'))
			.sort((a, b) => b.href.length - a.href.length)[0]?.href
	);
</script>

{#if !onLogin}
	<div class="border-b border-white/[0.06] bg-[#0b1120] px-6 py-3">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-1">
				<span class="mr-3 text-sm font-bold text-white">PDC Admin</span>
				{#each links as l}
					<a
						href={l.href}
						class="rounded px-3 py-1.5 text-sm transition-colors {activeHref === l.href
							? 'bg-emerald-500/20 text-emerald-400'
							: 'text-slate-400 hover:text-slate-200'}">{l.label}</a
					>
				{/each}
			</div>
			<div class="flex items-center gap-3 text-xs text-slate-400">
				{#if data.reviewer}<span>Reviewer: <span class="text-slate-200">{data.reviewer}</span></span>{/if}
				<form method="POST" action="/admin/login?/logout">
					<button class="rounded border border-white/[0.1] px-2 py-1 text-slate-400 hover:text-slate-200"
						>Log out</button
					>
				</form>
			</div>
		</div>
	</div>
{/if}

{@render children()}
