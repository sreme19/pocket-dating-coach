<script lang="ts">
	import Icon from './Icon.svelte';
	import ProfilePicker from './ProfilePicker.svelte';
	import ChatTester from './ChatTester.svelte';
	import TracePanel from './TracePanel.svelte';
	import { fullName, initials, avatarColor, type RosterUser, type AgentTrace, type ChatMsg, type OwnerMatch } from './lib';

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

	// Real-match inheritance: load the owner's actual mutual matches so the
	// operator can role-play a real person instead of an ad-hoc profile.
	let mode = $state<'adhoc' | 'real'>('adhoc');
	let realMatches = $state<OwnerMatch[]>([]);
	let selectedMatchId = $state<string | null>(null);
	let loadingMatches = $state(false);
	let matchGoal = $state('long-term');

	let selectedMatch = $derived(realMatches.find((m) => m.matchId === selectedMatchId) ?? null);

	async function pick(p: RosterUser) {
		sel = p;
		messages = [];
		error = '';
		setTrace(null);
		mode = 'adhoc';
		realMatches = [];
		selectedMatchId = null;
		loadingMatches = true;
		try {
			const res = await fetch(`/admin/test-suite/api/owner-matches?ownerId=${encodeURIComponent(p.id)}`);
			const data = await res.json();
			if (res.ok) realMatches = data.matches ?? [];
		} catch {
			/* leave realMatches empty — operator can still use ad-hoc */
		} finally {
			loadingMatches = false;
		}
	}

	function useReal() {
		if (!realMatches.length) return;
		mode = 'real';
		if (!selectedMatchId) selectedMatchId = realMatches[0].matchId;
		matchGoal = selectedMatch?.goal ?? 'long-term';
	}

	let matchCfg = $derived(
		mode === 'real' && selectedMatch
			? {
					name: selectedMatch.name,
					age: selectedMatch.age ?? undefined,
					goal: matchGoal,
					matchId: selectedMatch.matchId,
					matchUserId: selectedMatch.userId
				}
			: {
					name: adhoc.name,
					age: Number(adhoc.age),
					goal: adhoc.goal,
					matchId: null as string | null,
					matchUserId: null as string | null
				}
	);

	let chatDisabled = $derived(!sel || (mode === 'real' && !selectedMatch));

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
					<button class={mode === 'adhoc' ? 'on' : ''} onclick={() => (mode = 'adhoc')}>Ad-hoc profile</button>
					<button
						class={mode === 'real' ? 'on' : ''}
						disabled={loadingMatches || realMatches.length === 0}
						title={realMatches.length === 0 ? "this owner has no mutual matches" : 'role-play one of her real matches'}
						onclick={useReal}
					>
						Real match {loadingMatches ? '(…)' : realMatches.length ? `(${realMatches.length})` : '(none)'}
					</button>
				</div>

				{#if mode === 'real'}
					<div class="fade-in">
						<div class="field">
							<label>Which match</label>
							<select bind:value={selectedMatchId} onchange={() => (matchGoal = selectedMatch?.goal ?? 'long-term')}>
								{#each realMatches as m (m.matchId)}
									<option value={m.matchId}>{m.name}{m.age ? ` · ${m.age}` : ''}{m.archetype ? ` · ${m.archetype}` : ''}</option>
								{/each}
							</select>
						</div>
						{#if selectedMatch}
							<div style="display:flex; align-items:center; gap:8px; margin:8px 0 12px; font-size:11.5px; color:var(--text-4)">
								<span>Real match · loaded from her mutual matches{selectedMatch.city ? ` · ${selectedMatch.city}` : ''}</span>
								<code style="opacity:.7">match_id {selectedMatch.matchId.slice(0, 8)}…</code>
							</div>
						{/if}
						<div class="field-row">
							<div class="field">
								<label>Goal</label>
								<select bind:value={matchGoal}><option>long-term</option><option>marriage</option><option>open / serious</option><option>casual</option></select>
							</div>
						</div>
					</div>
				{:else}
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
				{/if}
			</div>
		{/if}

		{#if error}
			<div class="errbox"><Icon name="alert" size={16} /><span>{error}</span></div>
		{/if}

		<ChatTester
			disabled={chatDisabled}
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
