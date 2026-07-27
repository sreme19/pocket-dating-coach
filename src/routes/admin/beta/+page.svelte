<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Woman = {
		id: string;
		first_name: string;
		age: number | null;
		city: string | null;
		is_seed: boolean;
		token: string | null;
	};

	// Local copy of the women list so a freshly-generated token shows immediately.
	let women = $state<Woman[]>(data.women.map((w: Woman) => ({ ...w })));

	type Signup = {
		id: string;
		email: string;
		platform: 'ios' | 'android' | null;
		/** Pre-formatted "+91 98765 43210", or '' for rows collected before capture. */
		whatsapp: string;
		status: string;
		invited_at: string | null;
		ownerKey: string;
		referrerName: string;
		matchedName: string | null;
		created_at: string;
		matched_at: string | null;
		linkTypeLabel: string;
		genderBucket: 'male' | 'female' | 'pending';
	};

	// Local copy so an invite send flips the row to "invited" without a reload.
	let signups = $state<Signup[]>(data.signups.map((s: Signup) => ({ ...s })));

	// --- Summary dashboard: owner -> link type -> gender counts -------------
	type LinkTypeGroup = {
		linkTypeLabel: string;
		male: number;
		female: number;
		pending: number;
		total: number;
		rows: Signup[];
	};
	type OwnerGroup = {
		ownerKey: string;
		ownerName: string;
		male: number;
		female: number;
		pending: number;
		total: number;
		linkTypes: LinkTypeGroup[];
	};

	let summaryGroups = $derived.by(() => {
		const owners = new Map<string, OwnerGroup>();
		for (const s of signups) {
			let owner = owners.get(s.ownerKey);
			if (!owner) {
				owner = {
					ownerKey: s.ownerKey,
					ownerName: s.referrerName,
					male: 0,
					female: 0,
					pending: 0,
					total: 0,
					linkTypes: []
				};
				owners.set(s.ownerKey, owner);
			}
			owner[s.genderBucket]++;
			owner.total++;

			let linkType = owner.linkTypes.find((lt) => lt.linkTypeLabel === s.linkTypeLabel);
			if (!linkType) {
				linkType = { linkTypeLabel: s.linkTypeLabel, male: 0, female: 0, pending: 0, total: 0, rows: [] };
				owner.linkTypes.push(linkType);
			}
			linkType[s.genderBucket]++;
			linkType.total++;
			linkType.rows.push(s);
		}
		// Admin first (recruiting, not a real member), then by volume.
		return Array.from(owners.values()).sort((a, b) => {
			if (a.ownerKey === 'admin') return -1;
			if (b.ownerKey === 'admin') return 1;
			return b.total - a.total;
		});
	});

	let summaryTotals = $derived(
		summaryGroups.reduce(
			(acc, owner) => ({
				male: acc.male + owner.male,
				female: acc.female + owner.female,
				pending: acc.pending + owner.pending,
				total: acc.total + owner.total
			}),
			{ male: 0, female: 0, pending: 0, total: 0 }
		)
	);

	let expandedOwner = $state<string | null>(null);
	let expandedLinkType = $state<string | null>(null);

	function toggleOwner(ownerKey: string) {
		expandedOwner = expandedOwner === ownerKey ? null : ownerKey;
		expandedLinkType = null;
	}

	function toggleLinkType(ownerKey: string, linkTypeLabel: string) {
		const key = `${ownerKey}::${linkTypeLabel}`;
		expandedLinkType = expandedLinkType === key ? null : key;
	}

	// --- Collected emails pagination -----------------------------------------
	const PAGE_SIZE = 20;
	let emailPage = $state(1);
	let emailPageCount = $derived(Math.max(1, Math.ceil(signups.length / PAGE_SIZE)));
	let pagedSignups = $derived(
		signups.slice((emailPage - 1) * PAGE_SIZE, (emailPage - 1) * PAGE_SIZE + PAGE_SIZE)
	);

	function goToPage(p: number) {
		emailPage = Math.min(Math.max(1, p), emailPageCount);
	}

	let selectedId = $state('');
	let generating = $state(false);
	let genError = $state<string | null>(null);
	let copiedId = $state<string | null>(null);

	// Admin-level links (not tied to any user, shown as "Admin").
	let adminLinks = $state<{ women: string | null; men: string | null }>({ ...data.adminLinks });
	let generatingAdmin = $state<'women' | 'men' | null>(null);
	let adminGenError = $state<string | null>(null);
	let copiedAdminId = $state<string | null>(null);

	const MOODS = ['networking', 'casual', 'serious'] as const;
	type Mood = (typeof MOODS)[number];

	const MOOD_LABEL: Record<Mood, string> = {
		networking: 'Networking',
		casual: 'Casual',
		serious: 'Serious'
	};

	function womenMessageFor(mood: Mood, url: string): string {
		switch (mood) {
			case 'networking':
				return `riteangle is an invite-only network of high-functioning people — tech, finance, founders, creatives, sport. The circle is genuinely impressive and it's first come, first served. (Some people use it to meet someone too — no pressure.) 👉 ${url}`;
			case 'casual':
				return `Not like the other dating apps — everyone's identity-verified, skews high-earning tech/finance, and an AI weeds out the creeps before they reach you. 👉 ${url}`;
			case 'serious':
				return `A dating app for people who actually want something real — verified, serious, a lot of tech/finance types. Here's an invite 👉 ${url}`;
		}
	}

	async function generateAdmin(kind: 'admin_invite_women' | 'admin_invite_men') {
		const key = kind === 'admin_invite_women' ? 'women' : 'men';
		if (generatingAdmin) return;
		generatingAdmin = key;
		adminGenError = null;
		try {
			const res = await fetch('/admin/beta/link', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ kind })
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) {
				adminGenError = body?.error ?? `Failed (${res.status})`;
				return;
			}
			adminLinks = { ...adminLinks, [key]: body.token };
		} catch (err) {
			adminGenError = err instanceof Error ? err.message : 'Network error';
		} finally {
			generatingAdmin = null;
		}
	}

	async function copyText(id: string, text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copiedAdminId = id;
			setTimeout(() => {
				if (copiedAdminId === id) copiedAdminId = null;
			}, 1500);
		} catch {
			// Clipboard blocked — no-op; the text is visible for manual copy.
		}
	}

	// Per-row invite send state.
	let sendingId = $state<string | null>(null);
	let inviteError = $state<{ id: string; msg: string } | null>(null);

	async function sendInvite(s: Signup) {
		if (sendingId) return;
		if (!s.platform) return; // guarded in the UI too
		const label = s.invited_at ? 'Re-send' : 'Send';
		if (!confirm(`${label} the early-access invite to ${s.email} (${s.platform === 'ios' ? 'iOS' : 'Android'})?`)) {
			return;
		}
		sendingId = s.id;
		inviteError = null;
		try {
			const res = await fetch('/admin/beta/invite', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ signupId: s.id })
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) {
				inviteError = { id: s.id, msg: body?.error ?? `Failed (${res.status})` };
				return;
			}
			signups = signups.map((row) =>
				row.id === s.id ? { ...row, invited_at: body.invited_at } : row
			);
		} catch (err) {
			inviteError = { id: s.id, msg: err instanceof Error ? err.message : 'Network error' };
		} finally {
			sendingId = null;
		}
	}

	// Beta links are always shared on the public branded domain, not whatever
	// host the admin page happens to be loaded from (e.g. the vercel.app URL).
	const LINK_BASE = 'https://www.riteangle.dating';

	function linkFor(token: string | null): string {
		if (!token) return '';
		return `${LINK_BASE}/beta/${token}`;
	}

	async function generate() {
		if (!selectedId || generating) return;
		generating = true;
		genError = null;
		try {
			const res = await fetch('/admin/beta/link', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ referrerId: selectedId })
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) {
				genError = body?.error ?? `Failed (${res.status})`;
				return;
			}
			women = women.map((w) => (w.id === selectedId ? { ...w, token: body.token } : w));
		} catch (err) {
			genError = err instanceof Error ? err.message : 'Network error';
		} finally {
			generating = false;
		}
	}

	async function copy(id: string, token: string | null) {
		if (!token) return;
		try {
			await navigator.clipboard.writeText(linkFor(token));
			copiedId = id;
			setTimeout(() => {
				if (copiedId === id) copiedId = null;
			}, 1500);
		} catch {
			// Clipboard blocked — no-op; the link is visible for manual copy.
		}
	}

	function fmtDevice(platform: string | null): string {
		if (platform === 'ios') return 'iOS';
		if (platform === 'android') return 'Android';
		return '—';
	}

	function fmtDate(iso: string | null): string {
		if (!iso) return '—';
		return new Date(iso).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	let withLink = $derived(women.filter((w) => w.token));
	let selectedWoman = $derived(women.find((w) => w.id === selectedId) ?? null);
</script>

<div class="min-h-screen bg-[#0b1120] px-6 py-8 text-slate-100">
	<div class="mx-auto max-w-5xl">
	<h1 class="text-xl font-bold text-white">Beta Invites</h1>
	<p class="mt-1 text-sm text-slate-400">
		Generate a shareable link for a female user. Anyone who opens it and submits their email is
		added to the beta list, and is instantly matched with her once they finish onboarding and enter
		the matchmaker pool.
	</p>

	<!-- Summary dashboard: profile owner -> link type -> gender breakdown -->
	<section class="mt-6">
		<h2 class="text-sm font-semibold text-white">Invite summary ({summaryGroups.length})</h2>
		<p class="mt-1 text-sm text-slate-400">
			Grouped by profile owner. Expand a row to see which link type brought the invites in, and
			expand a link type to see the individual signups.
		</p>
		{#if summaryGroups.length === 0}
			<p class="mt-2 text-sm text-slate-500">No invites collected yet.</p>
		{:else}
			<div class="mt-3 overflow-x-auto rounded-lg border border-white/[0.08]">
				<table class="w-full text-left text-sm">
					<thead class="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
						<tr>
							<th class="px-4 py-2.5">Profile owner</th>
							<th class="px-4 py-2.5">Male</th>
							<th class="px-4 py-2.5">Female</th>
							<th class="px-4 py-2.5">Pending</th>
							<th class="px-4 py-2.5">Total</th>
							<th class="px-4 py-2.5"></th>
						</tr>
					</thead>
					<tbody class="divide-y divide-white/[0.05]">
						{#each summaryGroups as owner (owner.ownerKey)}
							<tr
								class="cursor-pointer hover:bg-white/[0.03]"
								onclick={() => toggleOwner(owner.ownerKey)}
							>
								<td class="px-4 py-2.5 font-medium text-slate-200">{owner.ownerName}</td>
								<td class="px-4 py-2.5 text-slate-300">{owner.male}</td>
								<td class="px-4 py-2.5 text-slate-300">{owner.female}</td>
								<td class="px-4 py-2.5 text-slate-400">{owner.pending}</td>
								<td class="px-4 py-2.5 text-slate-200">{owner.total}</td>
								<td class="px-4 py-2.5 text-right text-xs text-slate-500">
									{expandedOwner === owner.ownerKey ? '▲ collapse' : '▼ link types'}
								</td>
							</tr>
							{#if expandedOwner === owner.ownerKey}
								<tr>
									<td colspan="6" class="bg-black/20 px-4 py-3">
										<table class="w-full text-left text-xs">
											<thead class="uppercase tracking-wide text-slate-500">
												<tr>
													<th class="py-1.5 pr-3">Link type</th>
													<th class="py-1.5 pr-3">Male</th>
													<th class="py-1.5 pr-3">Female</th>
													<th class="py-1.5 pr-3">Pending</th>
													<th class="py-1.5 pr-3">Total</th>
													<th class="py-1.5"></th>
												</tr>
											</thead>
											<tbody class="divide-y divide-white/[0.05]">
												{#each owner.linkTypes as lt (lt.linkTypeLabel)}
													{@const ltKey = `${owner.ownerKey}::${lt.linkTypeLabel}`}
													<tr
														class="cursor-pointer hover:bg-white/[0.04]"
														onclick={() => toggleLinkType(owner.ownerKey, lt.linkTypeLabel)}
													>
														<td class="py-1.5 pr-3 text-slate-300">{lt.linkTypeLabel}</td>
														<td class="py-1.5 pr-3 text-slate-300">{lt.male}</td>
														<td class="py-1.5 pr-3 text-slate-300">{lt.female}</td>
														<td class="py-1.5 pr-3 text-slate-400">{lt.pending}</td>
														<td class="py-1.5 pr-3 text-slate-200">{lt.total}</td>
														<td class="py-1.5 text-right text-slate-500">
															{expandedLinkType === ltKey ? '▲ collapse' : '▼ signups'}
														</td>
													</tr>
													{#if expandedLinkType === ltKey}
														<tr>
															<td colspan="6" class="py-2">
																<ul class="space-y-1">
																	{#each lt.rows as row (row.id)}
																		<li class="flex items-center gap-2 text-slate-400">
																			<span class="text-slate-300">{row.email}</span>
																			<span class="text-slate-600">·</span>
																			<span>{row.genderBucket}</span>
																			<span class="text-slate-600">·</span>
																			<span>{row.status}</span>
																			<span class="text-slate-600">·</span>
																			<span>{fmtDate(row.created_at)}</span>
																		</li>
																	{/each}
																</ul>
															</td>
														</tr>
													{/if}
												{/each}
											</tbody>
										</table>
									</td>
								</tr>
							{/if}
						{/each}
						<tr class="bg-white/[0.03] font-semibold">
							<td class="px-4 py-2.5 text-slate-200">Grand total</td>
							<td class="px-4 py-2.5 text-slate-200">{summaryTotals.male}</td>
							<td class="px-4 py-2.5 text-slate-200">{summaryTotals.female}</td>
							<td class="px-4 py-2.5 text-slate-300">{summaryTotals.pending}</td>
							<td class="px-4 py-2.5 text-white">{summaryTotals.total}</td>
							<td class="px-4 py-2.5"></td>
						</tr>
					</tbody>
				</table>
			</div>
		{/if}
	</section>

	<!-- Generate -->
	<section class="mt-6 rounded-lg border border-white/[0.08] bg-[#0b1120] p-5">
		<h2 class="text-sm font-semibold text-white">Generate a link</h2>
		<div class="mt-3 flex flex-wrap items-center gap-3">
			<select
				bind:value={selectedId}
				class="min-w-[220px] rounded border border-white/[0.1] bg-[#111a2e] px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500"
			>
				<option value="">Select a female user…</option>
				{#each women as w}
					<option value={w.id}>
						{w.first_name}{w.age ? `, ${w.age}` : ''}{w.city ? ` · ${w.city}` : ''}{w.is_seed
							? ' (seed)'
							: ''}{w.token ? ' ✓ has link' : ''}
					</option>
				{/each}
			</select>

			<button
				onclick={generate}
				disabled={!selectedId || generating}
				class="rounded bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
			>
				{generating ? 'Generating…' : selectedWoman?.token ? 'Show link' : 'Generate link'}
			</button>
		</div>

		{#if genError}
			<p class="mt-3 text-sm text-red-400">{genError}</p>
		{/if}

		{#if selectedWoman?.token}
			<div class="mt-4 flex flex-wrap items-center gap-2">
				<code class="rounded border border-white/[0.1] bg-black/40 px-3 py-2 text-xs text-emerald-300">
					{linkFor(selectedWoman.token)}
				</code>
				<button
					onclick={() => copy(selectedWoman!.id, selectedWoman!.token)}
					class="rounded border border-white/[0.1] px-3 py-2 text-xs text-slate-300 hover:text-white"
				>
					{copiedId === selectedWoman.id ? 'Copied!' : 'Copy'}
				</button>
			</div>
		{/if}
	</section>

	<!-- Admin-level links (not tied to any user, shown as "Admin") -->
	<section class="mt-8 rounded-lg border border-white/[0.08] bg-[#0b1120] p-5">
		<h2 class="text-sm font-semibold text-white">Admin links</h2>
		<p class="mt-1 text-sm text-slate-400">
			Recruiting links not tied to any specific user — signups show up as "Admin" in Collected
			emails. Same landing page and beta pipeline, just generic branding instead of a real woman's
			card, and no cash reward or auto-match on either side.
		</p>

		{#if adminGenError}
			<p class="mt-3 text-sm text-red-400">{adminGenError}</p>
		{/if}

		<!-- Invite women: 3 mood-specific copy-ready messages -->
		<div class="mt-5">
			<h3 class="text-xs font-semibold uppercase tracking-wide text-slate-400">Invite women</h3>
			{#if !adminLinks.women}
				<button
					onclick={() => generateAdmin('admin_invite_women')}
					disabled={generatingAdmin === 'women'}
					class="mt-2 rounded bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
				>
					{generatingAdmin === 'women' ? 'Generating…' : 'Generate link'}
				</button>
			{:else}
				<div class="mt-3 space-y-2">
					{#each MOODS as mood}
						{@const msg = womenMessageFor(mood, `${linkFor(adminLinks.women)}?m=${mood}`)}
						<div class="flex items-start gap-2 rounded border border-white/[0.08] bg-black/20 p-3">
							<div class="min-w-[90px] pt-1 text-xs font-semibold text-slate-300">{MOOD_LABEL[mood]}</div>
							<p class="flex-1 text-xs leading-relaxed text-slate-300">{msg}</p>
							<button
								onclick={() => copyText(`women-${mood}`, msg)}
								class="shrink-0 rounded border border-white/[0.1] px-2.5 py-1 text-xs text-slate-300 hover:text-white"
							>
								{copiedAdminId === `women-${mood}` ? 'Copied!' : 'Copy text'}
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Invite men: plain link, no reward/matching -->
		<div class="mt-6">
			<h3 class="text-xs font-semibold uppercase tracking-wide text-slate-400">Invite men</h3>
			{#if !adminLinks.men}
				<button
					onclick={() => generateAdmin('admin_invite_men')}
					disabled={generatingAdmin === 'men'}
					class="mt-2 rounded bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
				>
					{generatingAdmin === 'men' ? 'Generating…' : 'Generate link'}
				</button>
			{:else}
				<div class="mt-3 flex flex-wrap items-center gap-2">
					<code class="rounded border border-white/[0.1] bg-black/40 px-3 py-2 text-xs text-emerald-300">
						{linkFor(adminLinks.men)}
					</code>
					<button
						onclick={() => copyText('men', linkFor(adminLinks.men))}
						class="rounded border border-white/[0.1] px-3 py-2 text-xs text-slate-300 hover:text-white"
					>
						{copiedAdminId === 'men' ? 'Copied!' : 'Copy link'}
					</button>
				</div>
			{/if}
		</div>
	</section>

	<!-- Existing links -->
	<section class="mt-8">
		<h2 class="text-sm font-semibold text-white">Active links ({withLink.length})</h2>
		{#if withLink.length === 0}
			<p class="mt-2 text-sm text-slate-500">No links generated yet.</p>
		{:else}
			<div class="mt-3 overflow-x-auto rounded-lg border border-white/[0.08]">
				<table class="w-full text-left text-sm">
					<thead class="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
						<tr>
							<th class="px-4 py-2.5">Female user</th>
							<th class="px-4 py-2.5">Link</th>
							<th class="px-4 py-2.5"></th>
						</tr>
					</thead>
					<tbody class="divide-y divide-white/[0.05]">
						{#each withLink as w}
							<tr>
								<td class="px-4 py-2.5 text-slate-200">
									{w.first_name}{w.age ? `, ${w.age}` : ''}
									{#if w.is_seed}<span class="ml-1 text-xs text-slate-500">seed</span>{/if}
								</td>
								<td class="px-4 py-2.5">
									<code class="text-xs text-emerald-300">{linkFor(w.token)}</code>
								</td>
								<td class="px-4 py-2.5 text-right">
									<button
										onclick={() => copy(w.id, w.token)}
										class="rounded border border-white/[0.1] px-2.5 py-1 text-xs text-slate-300 hover:text-white"
									>
										{copiedId === w.id ? 'Copied!' : 'Copy'}
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>

	<!-- Signups -->
	<section class="mt-8">
		<h2 class="text-sm font-semibold text-white">Collected emails ({signups.length})</h2>
		{#if signups.length === 0}
			<p class="mt-2 text-sm text-slate-500">No one has signed up through a link yet.</p>
		{:else}
			<div class="mt-3 overflow-x-auto rounded-lg border border-white/[0.08]">
				<table class="w-full text-left text-sm">
					<thead class="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
						<tr>
							<th class="px-4 py-2.5">Email</th>
							<th class="px-4 py-2.5">WhatsApp</th>
							<th class="px-4 py-2.5">Device</th>
							<th class="px-4 py-2.5">Referred by</th>
							<th class="px-4 py-2.5">Status</th>
							<th class="px-4 py-2.5">Submitted</th>
							<th class="px-4 py-2.5">Invite</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-white/[0.05]">
						{#each pagedSignups as s (s.id)}
							<tr>
								<td class="px-4 py-2.5 text-slate-200">{s.email}</td>
								<td class="px-4 py-2.5 whitespace-nowrap text-slate-300">
									{#if s.whatsapp}
										<a
											href={`https://wa.me/${s.whatsapp.replace(/[^0-9]/g, '')}`}
											target="_blank"
											rel="noreferrer"
											class="text-slate-300 underline decoration-white/20 hover:text-white"
										>{s.whatsapp}</a>
									{:else}
										<span class="text-slate-500">—</span>
									{/if}
								</td>
								<td class="px-4 py-2.5 text-slate-300">{fmtDevice(s.platform)}</td>
								<td class="px-4 py-2.5 text-slate-300">{s.referrerName}</td>
								<td class="px-4 py-2.5">
									{#if s.status === 'matched'}
										<span class="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
											matched{s.matchedName ? ` · ${s.matchedName}` : ''}
										</span>
									{:else if s.invited_at}
										<span class="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
											invite sent
										</span>
									{:else}
										<span class="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400">
											pending
										</span>
									{/if}
								</td>
								<td class="px-4 py-2.5 text-slate-400">{fmtDate(s.created_at)}</td>
								<td class="px-4 py-2.5">
									{#if !s.platform}
										<span class="text-xs text-slate-500" title="No device on file — this signup predates device capture.">no device</span>
									{:else}
										<div class="flex flex-col gap-1">
											<button
												onclick={() => sendInvite(s)}
												disabled={sendingId === s.id}
												class="w-fit rounded border border-white/[0.1] px-2.5 py-1 text-xs text-slate-200 transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
											>
												{sendingId === s.id ? 'Sending…' : s.invited_at ? 'Re-send invite' : 'Send invite'}
											</button>
											{#if s.invited_at}
												<span class="text-xs text-emerald-400">✓ invited · {fmtDate(s.invited_at)}</span>
											{/if}
											{#if inviteError && inviteError.id === s.id}
												<span class="text-xs text-red-400">{inviteError.msg}</span>
											{/if}
										</div>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			{#if emailPageCount > 1}
				<div class="mt-3 flex items-center justify-between text-sm text-slate-400">
					<span>
						Showing {(emailPage - 1) * PAGE_SIZE + 1}–{Math.min(emailPage * PAGE_SIZE, signups.length)}
						of {signups.length}
					</span>
					<div class="flex items-center gap-2">
						<button
							onclick={() => goToPage(emailPage - 1)}
							disabled={emailPage === 1}
							class="rounded border border-white/[0.1] px-2.5 py-1 text-xs text-slate-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
						>
							Prev
						</button>
						<span class="text-xs text-slate-500">Page {emailPage} of {emailPageCount}</span>
						<button
							onclick={() => goToPage(emailPage + 1)}
							disabled={emailPage === emailPageCount}
							class="rounded border border-white/[0.1] px-2.5 py-1 text-xs text-slate-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
						>
							Next
						</button>
					</div>
				</div>
			{/if}
		{/if}
	</section>
	</div>
</div>
