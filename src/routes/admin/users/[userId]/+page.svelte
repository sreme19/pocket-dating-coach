<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();

	const { user, verification, verifiedProofs, photoUrls, aiPhotoUrls, matches, recentMessages, masterData } = data;

	let isSeed = $state(user.isSeed);
	let toggling = $state(false);

	async function toggleSeed() {
		if (toggling) return;
		const next = !isSeed;
		if (!confirm(`Mark this user as ${next ? 'seed' : 'real'}?`)) return;
		toggling = true;
		try {
			const res = await fetch(`/admin/users/${user.id}/set-seed`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ isSeed: next }),
			});
			if (res.ok) isSeed = next;
		} finally {
			toggling = false;
		}
	}

	function fmtDate(iso: string | null) {
		if (!iso) return '—';
		return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
	}

	function statusColor(status: string) {
		if (status === 'completed') return 'bg-emerald-500/20 text-emerald-400';
		if (status === 'pending') return 'bg-amber-500/20 text-amber-400';
		return 'bg-slate-500/20 text-slate-400';
	}

	function matchStatusColor(status: string) {
		if (status === 'matched' || status === 'mutual') return 'bg-emerald-500/20 text-emerald-400';
		if (status === 'unmatched' || status === 'blocked') return 'bg-red-500/20 text-red-400';
		return 'bg-slate-500/20 text-slate-400';
	}
</script>

<div class="min-h-screen bg-[#0b1120] px-6 py-8 text-slate-100">
	<div class="mx-auto max-w-5xl space-y-8">

		<!-- Back -->
		<a href="/admin/analytics" class="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
			← Back to users
		</a>

		<!-- Header -->
		<div class="flex items-start gap-5">
			{#if user.avatarUrl}
				<img src={user.avatarUrl} alt={user.firstName ?? ''} class="h-20 w-20 rounded-full object-cover border border-white/10" />
			{:else}
				<div class="flex h-20 w-20 items-center justify-center rounded-full bg-pink-500/20 text-2xl font-bold text-pink-400 border border-white/10">
					{(user.firstName ?? '?')[0]?.toUpperCase()}
				</div>
			{/if}
			<div>
				<h1 class="text-2xl font-bold text-white">{user.firstName ?? 'Unknown'}{user.age ? `, ${user.age}` : ''}</h1>
				<p class="mt-1 text-sm text-slate-400">{user.city ?? '—'} · {user.gender ?? '—'} · {user.archetype ?? '—'}</p>
				<div class="mt-2 flex flex-wrap gap-2">
					<button
					onclick={toggleSeed}
					disabled={toggling}
					class="rounded px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-50
						{isSeed ? 'bg-slate-500/20 text-slate-400 hover:bg-amber-500/20 hover:text-amber-400' : 'bg-blue-500/20 text-blue-400 hover:bg-slate-500/20 hover:text-slate-400'}">
					{toggling ? '…' : isSeed ? 'seed' : 'real'}
				</button>
					<span class="rounded px-2 py-0.5 text-xs font-medium {(user.trustScore ?? 0) >= 70 ? 'bg-emerald-500/20 text-emerald-400' : (user.trustScore ?? 0) >= 40 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}">
						Trust {user.trustScore ?? 0}
					</span>
					<span class="rounded px-2 py-0.5 text-xs text-slate-500">Joined {fmtDate(user.createdAt)}</span>
				</div>
				<p class="mt-1 text-xs text-slate-600 font-mono">{user.id}</p>
			</div>
		</div>

		<!-- About -->
		{#if user.about || user.looking}
		<section class="rounded-lg border border-white/[0.08] bg-[#111a2e] p-5 space-y-2">
			<h2 class="text-sm font-semibold text-white">Profile</h2>
			{#if user.looking}<p class="text-sm text-slate-400"><span class="text-slate-300 font-medium">Looking for:</span> {user.looking}</p>{/if}
			{#if user.about}<p class="text-sm text-slate-400 leading-relaxed"><span class="text-slate-300 font-medium">About:</span> {user.about}</p>{/if}
		</section>
		{/if}

		<!-- Verification -->
		<section class="rounded-lg border border-white/[0.08] bg-[#111a2e] p-5">
			<h2 class="mb-3 text-sm font-semibold text-white">Verification Steps ({verification.length})</h2>
			{#if verification.length === 0}
				<p class="text-sm text-slate-500">No verification steps.</p>
			{:else}
				<div class="flex flex-wrap gap-2">
					{#each verification as v}
						<div class="rounded border border-white/[0.06] bg-black/30 px-3 py-1.5 text-xs">
							<span class="font-medium text-slate-300">{v.step}</span>
							<span class="ml-2 rounded px-1.5 py-0.5 text-[10px] {statusColor(v.status)}">{v.status}</span>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- Photos -->
		<section class="rounded-lg border border-white/[0.08] bg-[#111a2e] p-5">
			<h2 class="mb-3 text-sm font-semibold text-white">Uploaded Photos ({photoUrls.length})</h2>
			{#if photoUrls.length === 0}
				<p class="text-sm text-slate-500">No photos found.</p>
			{:else}
				<div class="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
					{#each photoUrls as p}
						<div class="group relative">
							<a href={p.url} target="_blank" rel="noopener">
								<img src={p.url} alt={p.label} class="h-32 w-full rounded-lg object-cover border border-white/[0.08] transition hover:border-pink-500/50" />
							</a>
							<p class="mt-1 truncate text-[10px] text-slate-500">{p.label}</p>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- AI Photos -->
		{#if aiPhotoUrls.length > 0}
		<section class="rounded-lg border border-white/[0.08] bg-[#111a2e] p-5">
			<h2 class="mb-3 text-sm font-semibold text-white">AI Generated Photos ({aiPhotoUrls.length})</h2>
			<div class="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
				{#each aiPhotoUrls as p}
					<div>
						<a href={p.url} target="_blank" rel="noopener">
							<img src={p.url} alt="AI photo" class="h-32 w-full rounded-lg object-cover border border-purple-500/20 transition hover:border-purple-400/50" />
						</a>
						<p class="mt-1 truncate text-[10px] text-slate-500">AI · {p.status}</p>
					</div>
				{/each}
			</div>
		</section>
		{/if}

		<!-- Verified Proofs -->
		{#if verifiedProofs.length > 0}
		<section class="rounded-lg border border-white/[0.08] bg-[#111a2e] p-5">
			<h2 class="mb-3 text-sm font-semibold text-white">Verified Proofs ({verifiedProofs.length})</h2>
			<div class="space-y-3">
				{#each verifiedProofs as proof}
					<div class="rounded border border-white/[0.06] bg-black/20 p-3">
						<p class="text-xs font-semibold text-slate-300 uppercase tracking-wide">{proof.category}</p>
						{#if proof.aggregated}<p class="mt-1 text-xs text-slate-400">{proof.aggregated}</p>{/if}
						{#if proof.insights.length > 0}
							<div class="mt-2 flex flex-wrap gap-1">
								{#each proof.insights as ins}
									<span class="rounded bg-white/[0.04] px-2 py-0.5 text-xs text-slate-400">{ins.emoji ?? ''} {ins.label}</span>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</section>
		{/if}

		<!-- Matches -->
		<section class="rounded-lg border border-white/[0.08] bg-[#111a2e] p-5">
			<h2 class="mb-3 text-sm font-semibold text-white">Matches ({matches.length})</h2>
			{#if matches.length === 0}
				<p class="text-sm text-slate-500">No matches yet.</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead class="text-slate-500 uppercase tracking-wide">
							<tr>
								<th class="py-2 pr-4">Partner</th>
								<th class="py-2 pr-4">Status</th>
								<th class="py-2 pr-4">Date</th>
								<th class="py-2">Match ID</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-white/[0.04]">
							{#each matches as m}
								<tr>
									<td class="py-2 pr-4 text-slate-300">{m.partnerName}</td>
									<td class="py-2 pr-4">
										<span class="rounded px-1.5 py-0.5 text-[10px] font-medium {matchStatusColor(m.status)}">{m.status}</span>
									</td>
									<td class="py-2 pr-4 text-slate-500">{fmtDate(m.createdAt)}</td>
									<td class="py-2 font-mono text-slate-600 text-[10px]">{m.id}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>

		<!-- Recent Messages -->
		{#if recentMessages.length > 0}
		<section class="rounded-lg border border-white/[0.08] bg-[#111a2e] p-5">
			<h2 class="mb-3 text-sm font-semibold text-white">Recent Messages Sent ({recentMessages.length})</h2>
			<div class="space-y-2">
				{#each recentMessages as msg}
					<div class="rounded border border-white/[0.05] bg-black/20 px-3 py-2">
						<div class="flex items-center gap-2 mb-1">
							<span class="text-[10px] text-slate-600">{fmtDate(msg.createdAt)}</span>
							{#if msg.isAi}<span class="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] text-purple-400">AI</span>{/if}
						</div>
						<p class="text-xs text-slate-400 leading-relaxed line-clamp-3">{msg.content}</p>
					</div>
				{/each}
			</div>
		</section>
		{/if}

	</div>
</div>
