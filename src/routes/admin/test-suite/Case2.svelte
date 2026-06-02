<script lang="ts">
	import Icon from './Icon.svelte';
	import ProfilePicker from './ProfilePicker.svelte';
	import ChatTester from './ChatTester.svelte';
	import TracePanel from './TracePanel.svelte';
	import { fullName, initials, avatarColor, type RosterUser, type AgentTrace, type ChatMsg } from './lib';

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
	let adhoc = $state({ name: 'Dev', age: 31, app: 'Verified Vibe', goal: 'long-term' });

	function pick(p: RosterUser) {
		sel = p;
		messages = [];
		error = '';
		setTrace(null);
	}

	let matchCfg = $derived({ name: adhoc.name, age: Number(adhoc.age), goal: adhoc.goal, matchId: null as string | null });

	async function send(text: string) {
		if (!sel) return;
		error = '';
		messages = [
			...messages,
			{ side: 'right', label: `${matchCfg.name} · the match`, color: '#475569', initials: matchCfg.name[0] ?? '?', text }
		];
		generating = true;
		try {
			const res = await fetch('/admin/test-suite/api/match-reply', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ ownerId: sel.id, match: matchCfg, message: text, persist })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'request failed');
			messages = [
				...messages,
				{
					side: 'left',
					label: `${sel.first_name} · via AI Bestie`,
					color: avatarColor(sel),
					initials: initials(sel),
					text: data.reply,
					coachingSignal: data.coachingSignal,
					ownerName: sel.first_name
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
				<Icon name="user" size={15} color="var(--rose)" /><h3>Female owner</h3>
				<span class="sub">· filtered to gender = woman</span>
			</div>
			<div class="card-pad">
				<ProfilePicker {roster} gender="woman" selectedId={sel?.id} onSelect={pick} label="Search female owners…" />
			</div>
		</div>

		{#if sel}
			<div class="card card-pad fade-in">
				<div class="eyebrow" style="margin-bottom:11px">The match you're role-playing</div>
				<div class="seg" style="margin-bottom:14px">
					<button class="on" disabled>Ad-hoc profile</button>
					<button disabled title="real-match inheritance — see §6">Real match (none)</button>
				</div>
				<div class="fade-in">
					<div class="field-row">
						<div class="field"><label>Match name</label><input bind:value={adhoc.name} /></div>
						<div class="field"><label>Age</label><input type="number" bind:value={adhoc.age} /></div>
					</div>
					<div class="field-row">
						<div class="field">
							<label>Dating app</label>
							<select bind:value={adhoc.app}><option>Verified Vibe</option><option>Hinge</option><option>Bumble</option></select>
						</div>
						<div class="field">
							<label>Goal</label>
							<select bind:value={adhoc.goal}><option>long-term</option><option>marriage</option><option>open / serious</option><option>casual</option></select>
						</div>
					</div>
				</div>
			</div>
		{/if}

		{#if error}
			<div class="errbox"><Icon name="alert" size={16} /><span>{error}</span></div>
		{/if}

		<ChatTester
			disabled={!sel}
			{messages}
			{generating}
			onSend={send}
			genLabel="AI Bestie is replying on her behalf"
			placeholder={`Message ${sel ? sel.first_name : 'her'} as the match… try a low-effort opener vs. a curious one`}
			emptyTitle="Role-play her match"
			emptyDesc="Type as the man messaging her. You'll see the on-her-behalf reply + the private coaching signal she'd get."
		>
			{#snippet head()}
				{#if sel}
					<div class="msg-av" style="background:#475569; width:34px; height:34px; font-size:13px">{matchCfg.name[0] ?? '?'}</div>
					<div style="flex:1; min-width:0">
						<div style="font-size:13.5px; font-weight:600">You are {matchCfg.name} <span style="color:var(--text-4); font-weight:400">(the match)</span></div>
						<div style="font-size:11.5px; color:var(--text-4)">chatting with {sel.first_name} — replies come from her AI Bestie</div>
					</div>
					<span class="badge rose"><Icon name="spark" size={11} />on her behalf</span>
				{:else}
					<div style="color:var(--text-4); font-size:13px">No owner loaded</div>
				{/if}
			{/snippet}
		</ChatTester>
	</div>
	<TracePanel {trace} />
</div>
