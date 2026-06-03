<script lang="ts">
	import Icon from './Icon.svelte';
	import TracePanel from './TracePanel.svelte';
	import { AGENT_LABEL, type AgentTrace, type RestorePayload, type ChatMsg } from './lib';

	let {
		trace,
		setTrace,
		onRestore = () => {}
	}: {
		trace: AgentTrace | null;
		setTrace: (t: AgentTrace | null) => void;
		onRestore?: (r: RestorePayload) => void;
	} = $props();

	interface RunRow {
		id: string;
		case_type: string;
		agent: string;
		reviewer: string | null;
		subject_user_id: string | null;
		counterpart_user_id: string | null;
		input: RestorePayload['input'];
		output: RestorePayload['output'];
		trace: AgentTrace;
		created_at: string;
	}

	// advisor + match_reply are conversations we can reopen / view; matchmaker isn't.
	const RESTORABLE = new Set(['advisor', 'match_reply']);

	// Read-only conversation preview shown in a modal when "View" is clicked.
	let viewing = $state<RunRow | null>(null);

	// Rebuild the exchange's chat bubbles from the run's stored input/output + trace,
	// mirroring how Case1/Case2 render a live conversation.
	function conversationOf(r: RunRow): ChatMsg[] {
		const subject = r.trace?.subject?.name ?? 'Owner';
		const subjInitials = subject.slice(0, 2).toUpperCase();
		if (r.case_type === 'match_reply') {
			const matchName = r.input?.match?.name ?? 'the match';
			return [
				{ side: 'right', label: `${matchName} · the match`, color: '#475569', initials: matchName[0]?.toUpperCase() ?? '?', text: r.input?.message ?? '' },
				{
					side: 'left',
					label: `${subject} · via AI Bestie`,
					color: 'var(--rose-strong)',
					initials: subjInitials,
					text: r.output?.reply ?? '',
					coachingSignal: r.output?.coachingSignal,
					ownerName: subject
				}
			];
		}
		// advisor — owner talks to their own Bestie/Wingman
		const wingman = r.trace?.routing?.resolvedAssistant === 'wingman';
		const asstColor = wingman ? 'var(--indigo-strong)' : 'var(--rose-strong)';
		return [
			{ side: 'right', label: subject, color: '#475569', initials: subjInitials, text: r.input?.message ?? '' },
			{ side: 'left', label: wingman ? 'AI Wingman' : 'AI Bestie', color: asstColor, initials: 'AI', text: r.output?.reply ?? '', suggestions: r.trace?.output?.suggestions }
		];
	}

	function segments(line: string) {
		return line.split(/(\[\d+\])/g).map((p) => ({ cite: /^\[\d+\]$/.test(p), text: p }));
	}

	function resume(r: RunRow) {
		onRestore({
			runId: r.id,
			caseType: r.case_type as 'advisor' | 'match_reply',
			subjectUserId: r.subject_user_id,
			counterpartUserId: r.counterpart_user_id,
			input: r.input,
			output: r.output,
			trace: r.trace
		});
	}

	let runs = $state<RunRow[]>([]);
	let loading = $state(true);
	let error = $state('');
	let selectedId = $state<string | null>(null);
	let copiedId = $state<string | null>(null);

	async function load() {
		loading = true;
		error = '';
		try {
			const res = await fetch('/admin/test-suite/api/runs');
			const d = await res.json();
			if (!res.ok) throw new Error(d.error || 'failed to load runs');
			runs = d.runs ?? [];
			// deep-link: ?run=<id> auto-selects that run (e.g. a link shared into Claude Code)
			if (!selectedId && typeof location !== 'undefined') {
				const wanted = new URLSearchParams(location.search).get('run');
				const found = wanted ? runs.find((r) => r.id === wanted) : null;
				if (found) pick(found);
			}
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

	function copyLink(r: RunRow) {
		const url = `${location.origin}${location.pathname}?tab=4&run=${r.id}`;
		try {
			navigator.clipboard.writeText(url);
		} catch {
			/* clipboard unavailable */
		}
		copiedId = r.id;
		setTimeout(() => {
			if (copiedId === r.id) copiedId = null;
		}, 1600);
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
							<div class="run-row">
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
										<div class="run-id">{r.id}</div>
									</div>
								</button>
								<div class="run-actions">
									{#if RESTORABLE.has(r.case_type)}
										<button
											class="run-link"
											title="View this conversation (read-only)"
											onclick={() => (viewing = r)}
										>
											<Icon name="eye" size={12} />View
										</button>
										<button
											class="run-link"
											title="Reopen this conversation in its tab and keep chatting"
											onclick={() => resume(r)}
										>
											<Icon name="msg" size={12} />Resume
										</button>
									{/if}
									<button
										class="run-link {copiedId === r.id ? 'done' : ''}"
										title="Copy a deep link to this run — paste into Claude Code to debug"
										onclick={() => copyLink(r)}
									>
										<Icon name={copiedId === r.id ? 'check' : 'link2'} size={12} />{copiedId === r.id ? 'Copied' : 'Copy link'}
									</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
	<TracePanel {trace} />
</div>

{#if viewing}
	<!-- Read-only conversation preview -->
	<div
		class="modal-backdrop"
		role="button"
		tabindex="-1"
		onclick={() => (viewing = null)}
		onkeydown={(e) => e.key === 'Escape' && (viewing = null)}
	>
		<div class="modal-panel" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()}>
			<div class="modal-head">
				<div class="msg-av" style="background:var(--indigo-strong)"><Icon name="cpu" size={14} /></div>
				<div style="flex:1; min-width:0">
					<div style="font-size:13.5px; font-weight:600">{AGENT_LABEL[viewing.agent] ?? viewing.agent}</div>
					<div style="font-size:11.5px; color:var(--text-4)">
						{new Date(viewing.created_at).toLocaleString()}{viewing.reviewer ? ` · ${viewing.reviewer}` : ''} · read-only
					</div>
				</div>
				<button class="run-link" title="Reopen to keep chatting" onclick={() => { const r = viewing; viewing = null; if (r) resume(r); }}>
					<Icon name="msg" size={12} />Resume
				</button>
				<button class="modal-close" aria-label="close" onclick={() => (viewing = null)}><Icon name="x" size={16} /></button>
			</div>
			<div class="modal-body">
				{#each conversationOf(viewing) as m, i (i)}
					<div class="msg {m.side}">
						<div class="msg-av" style="background:{m.color}">{m.initials}</div>
						<div style="min-width:0">
							<div class="msg-role">{m.label}</div>
							<div class="bubble">
								{#each m.text.split('\n') as line, li}
									<div style={li ? 'margin-top:8px' : ''}>
										{#each segments(line) as seg}
											{#if seg.cite}<span class="citation">{seg.text}</span>{:else}{seg.text}{/if}
										{/each}
									</div>
								{/each}
								{#if m.suggestions}
									<div class="suggestions">
										{#each m.suggestions as s}<span class="suggestion">{s}</span>{/each}
									</div>
								{/if}
								{#if m.coachingSignal}
									<div class="coaching {m.coachingSignal.color}">
										<span class="coaching-dot"></span>
										<span><span class="coaching-label">{m.coachingSignal.color} flag</span> · for {m.ownerName}'s private view — {m.coachingSignal.text}</span>
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}
