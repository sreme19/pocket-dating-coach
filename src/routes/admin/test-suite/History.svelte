<script lang="ts">
	import Icon from './Icon.svelte';
	import TracePanel from './TracePanel.svelte';
	import { AGENT_LABEL, type AgentTrace } from './lib';

	let {
		trace,
		setTrace
	}: { trace: AgentTrace | null; setTrace: (t: AgentTrace | null) => void } = $props();

	interface RunRow {
		id: string;
		case_type: string;
		agent: string;
		reviewer: string | null;
		subject_user_id: string | null;
		counterpart_user_id: string | null;
		trace: AgentTrace;
		created_at: string;
	}

	let runs = $state<RunRow[]>([]);
	let loading = $state(true);
	let error = $state('');
	let selectedId = $state<string | null>(null);

	async function load() {
		loading = true;
		error = '';
		try {
			const res = await fetch('/admin/test-suite/api/runs');
			const d = await res.json();
			if (!res.ok) throw new Error(d.error || 'failed to load runs');
			runs = d.runs ?? [];
		} catch (e) {
			error = e instanceof Error ? e.message : 'failed to load runs';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		load();
	});

	function pick(r: RunRow) {
		selectedId = r.id;
		setTrace(r.trace);
	}
</script>

<div class="case-grid">
	<div class="case-left">
		<div class="card">
			<div class="card-head">
				<Icon name="clock" size={15} color="var(--text-3)" /><h3>Past runs</h3>
				<span class="sub">· persisted to ts_runs</span>
				<button class="copy-btn" style="margin-left:auto" onclick={load}>
					<Icon name="route" size={13} />Refresh
				</button>
			</div>
			<div class="card-pad">
				{#if error}
					<div class="errbox"><Icon name="alert" size={16} /><span>{error}</span></div>
				{:else if loading}
					<div style="padding:24px; text-align:center; color:var(--text-4); font-size:12.5px">Loading…</div>
				{:else if runs.length === 0}
					<div style="padding:40px 16px; text-align:center; color:var(--text-4)">
						<Icon name="clock" size={32} />
						<div style="font-size:13px; color:var(--text-3); font-weight:500; margin-top:12px">No persisted runs yet</div>
						<div style="font-size:12px; margin-top:6px; line-height:1.5">
							Turn on <strong style="color:var(--text-3)">Persist this run</strong> before driving an agent, and it'll appear here.
							<br />(Requires the <code>ts_runs</code> table — apply the migration first.)
						</div>
					</div>
				{:else}
					<div class="roster" style="max-height:560px">
						{#each runs as r (r.id)}
							<button class="persona {selectedId === r.id ? 'sel' : ''}" onclick={() => pick(r)} style="align-items:flex-start">
								<div class="msg-av" style="background:var(--indigo-strong); margin-top:2px"><Icon name="cpu" size={13} /></div>
								<div class="persona-main">
									<div class="persona-name">
										{AGENT_LABEL[r.agent] ?? r.agent}
										<span class="badge slate">{r.case_type}</span>
									</div>
									<div class="persona-meta">
										{new Date(r.created_at).toLocaleString()}{r.reviewer ? ` · ${r.reviewer}` : ''}
									</div>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
	<TracePanel {trace} />
</div>
