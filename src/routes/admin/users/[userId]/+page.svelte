<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();

	const { user, verification, verifiedProofs, photoUrls, aiPhotoUrls, matches, masterData, activity, tips, aiConversations, qaAnswers } = data;

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

	let expandedMatch = $state<string | null>(null);
	let generatingAi = $state(false);
	let aiGenResult = $state<string | null>(null);
	let aiGenError = $state<string | null>(null);

	let unbanning = $state(false);
	let unbanned = $state(false);
	let unbanError = $state<string | null>(null);

	async function unbanUser() {
		if (unbanning || !confirm('Unban and restore this user?')) return;
		unbanning = true;
		unbanError = null;
		try {
			const res = await fetch(`/admin/users/${user.id}/unban`, { method: 'POST' });
			const body = await res.json();
			if (res.ok) unbanned = true;
			else unbanError = body.error ?? 'Unban failed';
		} catch {
			unbanError = 'Network error';
		} finally {
			unbanning = false;
		}
	}

	async function generateAiPhotos() {
		if (generatingAi) return;
		generatingAi = true;
		aiGenResult = null;
		aiGenError = null;
		try {
			const res = await fetch(`/admin/users/${user.id}/generate-ai-photos`, { method: 'POST' });
			const body = await res.json();
			if (res.ok) aiGenResult = body.imageUrl;
			else aiGenError = body.error ?? 'Generation failed';
		} catch (e) {
			aiGenError = 'Network error';
		} finally {
			generatingAi = false;
		}
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
				{#if user.email}<p class="mt-0.5 text-xs text-slate-500">✉ {user.email}</p>{/if}
				{#if user.phone}<p class="mt-0.5 text-xs text-slate-500">📞 {user.phone}</p>{/if}
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
					{#if user.deletedAt && !unbanned}
						<span class="rounded px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-400">banned / soft-deleted</span>
						<button
							onclick={unbanUser}
							disabled={unbanning}
							class="rounded px-2 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50 transition-colors"
						>{unbanning ? 'Unbanning…' : 'Unban'}</button>
					{/if}
					{#if unbanned}
						<span class="rounded px-2 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-400">Unbanned</span>
					{/if}
					{#if unbanError}
						<span class="rounded px-2 py-0.5 text-xs text-red-400">{unbanError}</span>
					{/if}
				</div>
				<p class="mt-1 text-xs text-slate-600 font-mono">{user.id}</p>
			</div>
		</div>

		<!-- Activity Stats -->
		<section class="rounded-lg border border-white/[0.08] bg-[#111a2e] p-5">
			<h2 class="mb-4 text-sm font-semibold text-white">Activity</h2>
			<div class="grid grid-cols-3 gap-4 mb-5">
				<div class="rounded bg-black/20 p-3 text-center">
					<p class="text-2xl font-bold text-pink-400">{activity.likesGiven}</p>
					<p class="text-xs text-slate-500 mt-1">Likes Sent</p>
				</div>
				<div class="rounded bg-black/20 p-3 text-center">
					<p class="text-2xl font-bold text-emerald-400">{activity.likesReceived}</p>
					<p class="text-xs text-slate-500 mt-1">Likes Received</p>
				</div>
				<div class="rounded bg-black/20 p-3 text-center">
					<p class="text-2xl font-bold text-slate-400">{activity.passesSent}</p>
					<p class="text-xs text-slate-500 mt-1">Passes Sent</p>
				</div>
			</div>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
				{#if activity.recentLikesGiven.length > 0}
				<div>
					<p class="text-xs font-medium text-slate-400 mb-2">Recent Likes Sent</p>
					<div class="space-y-1">
						{#each activity.recentLikesGiven as l}
							<div class="flex justify-between text-xs">
								<span class="text-slate-300">{l.name}</span>
								<span class="text-slate-600">{l.createdAt?.slice(0,10)}</span>
							</div>
						{/each}
					</div>
				</div>
				{/if}
				{#if activity.recentLikesReceived.length > 0}
				<div>
					<p class="text-xs font-medium text-slate-400 mb-2">Recent Likes Received</p>
					<div class="space-y-1">
						{#each activity.recentLikesReceived as l}
							<div class="flex justify-between text-xs">
								<span class="text-slate-300">{l.name}</span>
								<span class="text-slate-600">{l.createdAt?.slice(0,10)}</span>
							</div>
						{/each}
					</div>
				</div>
				{/if}
				{#if activity.recentPasses.length > 0}
				<div>
					<p class="text-xs font-medium text-slate-400 mb-2">Recent Passes</p>
					<div class="space-y-1">
						{#each activity.recentPasses as p}
							<div class="flex justify-between text-xs">
								<span class="text-slate-300">{p.name}</span>
								<span class="text-slate-600">{p.createdAt?.slice(0,10)}</span>
							</div>
						{/each}
					</div>
				</div>
				{/if}
			</div>
		</section>

		<!-- About -->
		{#if user.about || user.looking}
		<section class="rounded-lg border border-white/[0.08] bg-[#111a2e] p-5 space-y-2">
			<h2 class="text-sm font-semibold text-white">Profile</h2>
			{#if user.looking}<p class="text-sm text-slate-400"><span class="text-slate-300 font-medium">Looking for:</span> {user.looking}</p>{/if}
			{#if user.about}<p class="text-sm text-slate-400 leading-relaxed"><span class="text-slate-300 font-medium">About:</span> {user.about}</p>{/if}
		</section>
		{/if}

		<!-- Q&A Answers -->
		{#if qaAnswers && qaAnswers.length > 0}
		<section class="rounded-lg border border-white/[0.08] bg-[#111a2e] p-5">
			<h2 class="mb-4 text-sm font-semibold text-white">Q&A Answers</h2>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				{#each qaAnswers as qa}
					<div>
						<p class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 capitalize">{qa.section}</p>
						<div class="flex flex-wrap gap-1.5">
							{#each qa.items as item}
								<span class="rounded-full bg-white/[0.05] border border-white/[0.08] px-2.5 py-1 text-xs text-slate-300">{item}</span>
							{/each}
						</div>
					</div>
				{/each}
			</div>
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
							{#if v.updatedAt}<span class="ml-1 text-slate-600">{v.updatedAt.slice(0,10)}</span>{/if}
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
		<section class="rounded-lg border border-white/[0.08] bg-[#111a2e] p-5">
			<div class="mb-3 flex items-center justify-between">
				<h2 class="text-sm font-semibold text-white">AI Generated Photos ({aiPhotoUrls.length})</h2>
				<button
					type="button"
					onclick={generateAiPhotos}
					disabled={generatingAi}
					class="rounded border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-300 transition-colors hover:bg-purple-500/20 disabled:opacity-50"
				>
					{generatingAi ? '⏳ Generating…' : '✨ Generate AI Photos'}
				</button>
			</div>
			{#if aiGenError}<p class="mb-2 text-xs text-red-400">{aiGenError}</p>{/if}
			{#if aiGenResult}
				<div class="mb-3">
					<p class="mb-1 text-xs text-emerald-400">✓ Generated successfully!</p>
					<img src={aiGenResult} alt="New AI photo" class="h-40 rounded-lg border border-purple-500/30 object-cover" />
				</div>
			{/if}
		{#if aiPhotoUrls.length > 0}
			<div class="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
				{#each aiPhotoUrls as p}
					<div>
						<a href={p.url} target="_blank" rel="noopener">
							<img src={p.url} alt="AI photo" class="h-32 w-full rounded-lg object-cover border border-purple-500/20 transition hover:border-purple-400/50" />
						</a>
						<p class="mt-1 truncate text-[10px] text-slate-500">AI · {p.label}</p>
					</div>
				{/each}
			</div>
		{:else}
			<p class="text-sm text-slate-500">No AI photos yet.</p>
		{/if}
		</section>

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

		<!-- Tips Received -->
		{#if tips.totalReceived > 0}
		<section class="rounded-lg border border-white/[0.08] bg-[#111a2e] p-5">
			<h2 class="mb-3 text-sm font-semibold text-white">Tips Received ({tips.totalReceived})</h2>
			<div class="flex flex-wrap gap-2">
				{#each tips.summary as t}
					<span class="rounded-full bg-pink-500/10 border border-pink-500/20 px-3 py-1 text-xs text-pink-300">
						{t.tag} <span class="ml-1 font-bold text-pink-400">×{t.count}</span>
					</span>
				{/each}
			</div>
		</section>
		{/if}

		<!-- Matches + Messages -->
		<section class="rounded-lg border border-white/[0.08] bg-[#111a2e] p-5">
			<h2 class="mb-3 text-sm font-semibold text-white">Matches ({matches.length})</h2>
			{#if matches.length === 0}
				<p class="text-sm text-slate-500">No matches yet.</p>
			{:else}
				<div class="space-y-3">
					{#each matches as m}
						<div class="rounded border border-white/[0.06] bg-black/20">
							<button
								type="button"
								class="w-full flex items-center justify-between px-4 py-3 text-left"
								onclick={() => expandedMatch = expandedMatch === m.id ? null : m.id}
							>
								<div class="flex items-center gap-3">
									<span class="text-sm font-medium text-slate-200">{m.partnerName}</span>
									<span class="rounded px-1.5 py-0.5 text-[10px] font-medium {matchStatusColor(m.status)}">{m.status}</span>
									{#if m.messages.length > 0}
										<span class="text-xs text-slate-500">{m.messages.length} msgs</span>
									{/if}
								</div>
								<div class="flex items-center gap-3">
									<span class="text-xs text-slate-600">{fmtDate(m.createdAt)}</span>
									<span class="text-slate-500 text-xs">{expandedMatch === m.id ? '▲' : '▼'}</span>
								</div>
							</button>
							{#if expandedMatch === m.id && m.messages.length > 0}
								<div class="border-t border-white/[0.04] px-4 py-3 space-y-2 max-h-96 overflow-y-auto">
									{#each m.messages as msg}
										<div class="flex {msg.senderIsMe ? 'justify-end' : 'justify-start'}">
											<div class="max-w-[75%] rounded-lg px-3 py-2 text-xs {msg.senderIsMe ? 'bg-pink-500/20 text-pink-100' : 'bg-white/[0.06] text-slate-300'}">
												{#if msg.isAi}<span class="text-[10px] text-purple-400 block mb-0.5">🤖 AI</span>{/if}
												<p class="leading-relaxed">{msg.content}</p>
												<p class="mt-1 text-[10px] opacity-40">{msg.createdAt?.slice(11,16)}</p>
											</div>
										</div>
									{/each}
								</div>
							{:else if expandedMatch === m.id}
								<div class="border-t border-white/[0.04] px-4 py-3">
									<p class="text-xs text-slate-500">No messages in this match yet.</p>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- AI Conversations -->
		{#if aiConversations.length > 0}
		<section class="rounded-lg border border-white/[0.08] bg-[#111a2e] p-5">
			<h2 class="mb-3 text-sm font-semibold text-white">AI Conversations ({aiConversations.length})</h2>
			<div class="space-y-3">
				{#each aiConversations as c}
					<div class="rounded border border-white/[0.06] bg-black/20 p-3">
						<div class="flex items-center justify-between mb-2">
							<span class="text-xs font-medium text-purple-300 capitalize">{c.assistantType} · {c.exchangeCount} exchanges</span>
							<span class="text-xs text-slate-600">{fmtDate(c.updatedAt)}</span>
						</div>
						{#if c.lastFewMessages.length > 0}
							<div class="space-y-1.5">
								{#each c.lastFewMessages as msg}
									<div class="text-xs">
										<span class="text-slate-500 uppercase text-[10px] mr-2">{msg.role}</span>
										<span class="text-slate-400 leading-relaxed">{msg.content.slice(0, 200)}{msg.content.length > 200 ? '…' : ''}</span>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</section>
		{/if}

	</div>
</div>
