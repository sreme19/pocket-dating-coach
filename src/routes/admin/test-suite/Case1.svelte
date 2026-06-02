<script lang="ts">
	import Icon from './Icon.svelte';
	import ProfilePicker from './ProfilePicker.svelte';
	import ChatTester from './ChatTester.svelte';
	import TracePanel from './TracePanel.svelte';
	import {
		fullName,
		initials,
		assistantFor,
		avatarColor,
		type RosterUser,
		type AgentTrace,
		type ChatMsg
	} from './lib';

	let {
		roster,
		trace,
		setTrace,
		persist = false
	}: {
		roster: RosterUser[];
		trace: AgentTrace | null;
		setTrace: (t: AgentTrace | null) => void;
		persist?: boolean;
	} = $props();

	let sel = $state<RosterUser | null>(null);
	let messages = $state<ChatMsg[]>([]);
	let generating = $state(false);
	let error = $state('');

	function pick(p: RosterUser) {
		sel = p;
		messages = [];
		error = '';
		setTrace(null);
	}

	let a = $derived(sel ? assistantFor(sel) : null);

	async function send(text: string) {
		if (!sel) return;
		error = '';
		messages = [
			...messages,
			{ side: 'right', label: sel.first_name, color: avatarColor(sel), initials: initials(sel), text }
		];
		generating = true;
		try {
			const res = await fetch('/admin/test-suite/api/advisor', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ userId: sel.id, message: text, persist })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'request failed');
			const asst = assistantFor(sel);
			messages = [
				...messages,
				{
					side: 'left',
					label: asst === 'bestie' ? 'AI Bestie' : 'AI Wingman',
					color: asst === 'bestie' ? 'var(--rose-strong)' : 'var(--indigo-strong)',
					initials: 'AI',
					text: data.reply,
					suggestions: data.trace?.output?.suggestions
				}
			];
			setTrace(data.trace);
		} catch (e) {
			error = e instanceof Error ? e.message : 'request failed';
		} finally {
			generating = false;
		}
	}
</script>

<div class="case-grid">
	<div class="case-left">
		<div class="card">
			<div class="card-head">
				<Icon name="user" size={15} color="var(--text-3)" /><h3>Load a profile</h3>
				<span class="sub">· assistant auto-derived from gender</span>
			</div>
			<div class="card-pad"><ProfilePicker {roster} selectedId={sel?.id} onSelect={pick} /></div>
		</div>

		{#if error}
			<div class="errbox"><Icon name="alert" size={16} /><span>{error}</span></div>
		{/if}

		<ChatTester
			disabled={!sel}
			{messages}
			{generating}
			onSend={send}
			genLabel={a === 'bestie' ? 'AI Bestie is thinking' : 'AI Wingman is thinking'}
			placeholder="Prompt the assistant as its owner… e.g. how can I get better matches?"
			emptyTitle="Prompt the assistant directly"
			emptyDesc="You're talking as the owner. Replies are byte-identical to what they'd see in-app."
		>
			{#snippet head()}
				{#if sel}
					<div class="avatar" style="width:34px; height:34px; font-size:13px; background:linear-gradient(150deg,{avatarColor(sel)},{avatarColor(sel)}cc)">{initials(sel)}</div>
					<div style="flex:1; min-width:0">
						<div style="font-size:13.5px; font-weight:600">{fullName(sel)}</div>
						<div style="font-size:11.5px; color:var(--text-4)">{sel.archetype}</div>
					</div>
					<span class="assistant-tag {a}" style="font-size:11px; padding:4px 10px">{a === 'bestie' ? 'AI Bestie' : 'AI Wingman'}</span>
				{:else}
					<div style="color:var(--text-4); font-size:13px">No profile loaded</div>
				{/if}
			{/snippet}
		</ChatTester>
	</div>
	<TracePanel {trace} />
</div>
