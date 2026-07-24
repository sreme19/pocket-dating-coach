<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Row = {
		id: string;
		referrerName: string;
		referredName: string;
		amountInr: number;
		tierRate: number;
		rewardIndex: number;
		status: string;
		mood: string | null;
		createdAt: string;
		payableAt: string;
		paidAt: string | null;
		paidBy: string | null;
		payoutRef: string | null;
	};

	// Local copy so a "mark paid" flips the row without a reload.
	let rows = $state<Row[]>(data.rows.map((r: Row) => ({ ...r })));
	let payingId = $state<string | null>(null);
	let err = $state<{ id: string; msg: string } | null>(null);

	let totalPayable = $derived(
		rows.filter((r) => r.status === 'payable').reduce((s, r) => s + r.amountInr, 0)
	);
	let totalPaid = $derived(rows.filter((r) => r.status === 'paid').reduce((s, r) => s + r.amountInr, 0));
	let countPayable = $derived(rows.filter((r) => r.status === 'payable').length);

	async function markPaid(r: Row) {
		if (payingId) return;
		const ref = window.prompt(
			`Record ₹${r.amountInr} to ${r.referrerName} as PAID.\nThis does NOT send money — pay via UPI/bank first, then log the reference here (optional):`,
			''
		);
		if (ref === null) return; // cancelled
		if (!confirm(`Confirm: ₹${r.amountInr} has been paid to ${r.referrerName}?`)) return;
		payingId = r.id;
		err = null;
		try {
			const res = await fetch('/admin/referral-payouts/mark-paid', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ rewardId: r.id, payoutRef: ref })
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) {
				err = { id: r.id, msg: body?.error ?? `Failed (${res.status})` };
				return;
			}
			rows = rows.map((row) =>
				row.id === r.id
					? { ...row, status: 'paid', paidAt: body.paid_at, payoutRef: ref || null }
					: row
			);
		} catch (e) {
			err = { id: r.id, msg: e instanceof Error ? e.message : 'Network error' };
		} finally {
			payingId = null;
		}
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
</script>

<div class="min-h-screen bg-[#0b1120] px-6 py-8 text-slate-100">
	<div class="mx-auto max-w-5xl">
		<h1 class="text-xl font-bold text-white">Referral payouts</h1>
		<p class="mt-1 text-sm text-slate-400">
			Cash owed to women who invited other women (Flow 2). A reward becomes payable once the invited
			woman completes verification. Pay it manually via UPI/bank, then mark it paid here — this page
			never moves money.
		</p>

		<!-- Summary -->
		<div class="mt-6 grid grid-cols-3 gap-3">
			<div class="rounded-lg border border-white/[0.08] bg-[#0b1120] p-4">
				<div class="text-2xl font-bold text-amber-400">₹{totalPayable}</div>
				<div class="mt-0.5 text-xs text-slate-400">owed now ({countPayable})</div>
			</div>
			<div class="rounded-lg border border-white/[0.08] bg-[#0b1120] p-4">
				<div class="text-2xl font-bold text-emerald-400">₹{totalPaid}</div>
				<div class="mt-0.5 text-xs text-slate-400">paid to date</div>
			</div>
			<div class="rounded-lg border border-white/[0.08] bg-[#0b1120] p-4">
				<div class="text-2xl font-bold text-white">{rows.length}</div>
				<div class="mt-0.5 text-xs text-slate-400">total referrals</div>
			</div>
		</div>

		<!-- Ledger -->
		<section class="mt-8">
			<h2 class="text-sm font-semibold text-white">Ledger ({rows.length})</h2>
			{#if rows.length === 0}
				<p class="mt-2 text-sm text-slate-500">No woman-to-woman referrals have been earned yet.</p>
			{:else}
				<div class="mt-3 overflow-x-auto rounded-lg border border-white/[0.08]">
					<table class="w-full text-left text-sm">
						<thead class="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
							<tr>
								<th class="px-4 py-2.5">Referrer</th>
								<th class="px-4 py-2.5">Invited</th>
								<th class="px-4 py-2.5">#</th>
								<th class="px-4 py-2.5">Amount</th>
								<th class="px-4 py-2.5">Mood</th>
								<th class="px-4 py-2.5">Earned</th>
								<th class="px-4 py-2.5">Status</th>
								<th class="px-4 py-2.5"></th>
							</tr>
						</thead>
						<tbody class="divide-y divide-white/[0.05]">
							{#each rows as r (r.id)}
								<tr>
									<td class="px-4 py-2.5 text-slate-200">{r.referrerName}</td>
									<td class="px-4 py-2.5 text-slate-300">{r.referredName}</td>
									<td class="px-4 py-2.5 text-slate-400">{r.rewardIndex}</td>
									<td class="px-4 py-2.5 font-medium text-slate-100">₹{r.amountInr}</td>
									<td class="px-4 py-2.5 text-slate-400">{r.mood ?? '—'}</td>
									<td class="px-4 py-2.5 text-slate-400">{fmtDate(r.payableAt)}</td>
									<td class="px-4 py-2.5">
										{#if r.status === 'paid'}
											<span class="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
												paid{r.paidAt ? ` · ${fmtDate(r.paidAt)}` : ''}
											</span>
											{#if r.payoutRef}
												<div class="mt-0.5 text-xs text-slate-500">ref: {r.payoutRef}</div>
											{/if}
										{:else if r.status === 'void'}
											<span class="rounded-full bg-slate-500/15 px-2 py-0.5 text-xs text-slate-400" title="Over the 100 cap — no payout.">
												void (over cap)
											</span>
										{:else}
											<span class="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400">
												payable
											</span>
										{/if}
									</td>
									<td class="px-4 py-2.5 text-right">
										{#if r.status === 'payable'}
											<button
												onclick={() => markPaid(r)}
												disabled={payingId === r.id}
												class="rounded border border-white/[0.1] px-2.5 py-1 text-xs text-slate-200 transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
											>
												{payingId === r.id ? 'Saving…' : 'Mark paid'}
											</button>
											{#if err && err.id === r.id}
												<div class="mt-0.5 text-xs text-red-400">{err.msg}</div>
											{/if}
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>
	</div>
</div>
