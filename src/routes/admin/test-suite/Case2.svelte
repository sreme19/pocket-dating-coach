<script lang="ts">
	import Icon from './Icon.svelte';
	import ProfilePicker from './ProfilePicker.svelte';
	import ChatTester from './ChatTester.svelte';
	import TracePanel from './TracePanel.svelte';
	import { fullName, initials, avatarColor, type RosterUser, type AgentTrace, type ChatMsg, type OwnerMatch, type RestorePayload } from './lib';

	let {
		roster,
		trace,
		setTrace,
		persist = false,
		restore = null,
		clearRestore = () => {}
	}: {
		roster: RosterUser[];
		trace: AgentTrace | null;
		setTrace: (t: AgentTrace | null) => void;
		persist?: boolean;
		restore?: RestorePayload | null;
		clearRestore?: () => void;
	} = $props();

	let sel = $state<RosterUser | null>(null);
	let messages = $state<ChatMsg[]>([]);
	let generating = $state(false);
	let error = $state('');
	let adhoc = $state({ name: 'Dev', age: 31, app: 'Verified Vibe', goal: 'long-term' });

	// Three match sources the operator can role-play against her Bestie:
	//  · adhoc  — type a throwaway name/age
	//  · real   — one of her actual mutual matches (loaded from owner-matches)
	//  · roster — ANY other user (seed or real man), to pair an arbitrary profile
	//             with her and see how the Bestie replies on her behalf.
	let mode = $state<'adhoc' | 'real' | 'roster'>('adhoc');
	let realMatches = $state<OwnerMatch[]>([]);
	let selectedMatchId = $state<string | null>(null);
	let loadingMatches = $state(false);
	let matchGoal = $state('long-term');
	let rosterMatch = $state<RosterUser | null>(null);
	let rosterGoal = $state('long-term');

	let selectedMatch = $derived(realMatches.find((m) => m.matchId === selectedMatchId) ?? null);

	async function loadOwnerMatches(ownerId: string) {
		realMatches = [];
		selectedMatchId = null;
		loadingMatches = true;
		try {
			const res = await fetch(`/admin/test-suite/api/owner-matches?ownerId=${encodeURIComponent(ownerId)}`);
			const data = await res.json();
			if (res.ok) realMatches = data.matches ?? [];
		} catch {
			/* leave realMatches empty — operator can still use ad-hoc / roster */
		} finally {
			loadingMatches = false;
		}
	}

	async function pick(p: RosterUser) {
		sel = p;
		messages = [];
		error = '';
		setTrace(null);
		mode = 'adhoc';
		rosterMatch = null;
		await loadOwnerMatches(p.id);
	}

	// Reopen a past match-reply run from History: load the owner + her matches,
	// re-seed the exchange, and reselect whichever match source the run used so
	// the operator can keep chatting against the same match.
	$effect(() => {
		if (!restore || restore.caseType !== 'match_reply') return;
		const r = restore;
		clearRestore(); // consume immediately so this doesn't re-fire
		void applyRestore(r);
	});

	async function applyRestore(r: RestorePayload) {
		const owner = roster.find((u) => u.id === r.subjectUserId);
		if (!owner) return;
		sel = owner;
		error = '';
		rosterMatch = null;
		const m = r.input?.match ?? {};
		const matchName = m.name ?? 'the match';
		messages = [
			{ side: 'right', label: `${matchName} · the match`, color: '#475569', initials: matchName[0] ?? '?', text: r.input?.message ?? '' },
			{
				side: 'left',
				label: `${owner.first_name} · via AI Bestie`,
				color: avatarColor(owner),
				initials: initials(owner),
				text: r.output?.reply ?? '',
				coachingSignal: r.output?.coachingSignal,
				ownerName: owner.first_name
			}
		];
		setTrace(r.trace);

		await loadOwnerMatches(owner.id);

		// Reselect the source the run used so "send" continues against the same match.
		if (m.matchId && realMatches.some((rm) => rm.matchId === m.matchId)) {
			mode = 'real';
			selectedMatchId = m.matchId;
			matchGoal = m.goal ?? selectedMatch?.goal ?? 'long-term';
		} else if (m.matchUserId && roster.some((u) => u.id === m.matchUserId)) {
			mode = 'roster';
			rosterMatch = roster.find((u) => u.id === m.matchUserId) ?? null;
			rosterGoal = m.goal ?? 'long-term';
		} else {
			mode = 'adhoc';
			adhoc = { name: m.name ?? 'Dev', age: Number(m.age) || 31, app: adhoc.app, goal: m.goal ?? 'long-term' };
		}
	}

	function useReal() {
		if (!realMatches.length) return;
		mode = 'real';
		if (!selectedMatchId) selectedMatchId = realMatches[0].matchId;
		matchGoal = selectedMatch?.goal ?? 'long-term';
	}

	// Men available to pair with her — excludes herself; seed + real both allowed.
	let rosterMen = $derived(roster.filter((u) => u.gender === 'man' && u.id !== sel?.id));

	let matchCfg = $derived.by(() => {
		if (mode === 'real' && selectedMatch)
			return {
				name: selectedMatch.name,
				age: selectedMatch.age ?? undefined,
				goal: matchGoal,
				matchId: selectedMatch.matchId,
				matchUserId: selectedMatch.userId
			};
		if (mode === 'roster' && rosterMatch)
			return {
				name: rosterMatch.first_name,
				age: rosterMatch.age,
				goal: rosterGoal,
				// No real thread exists between them — link the counterpart for logging
				// (counterpart_user_id), but there's no match_id to inherit.
				matchId: null as string | null,
				matchUserId: rosterMatch.id
			};
		return {
			name: adhoc.name,
			age: Number(adhoc.age),
			goal: adhoc.goal,
			matchId: null as string | null,
			matchUserId: null as string | null
		};
	});

	let chatDisabled = $derived(
		!sel || (mode === 'real' && !selectedMatch) || (mode === 'roster' && !rosterMatch)
	);

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
					<button
						class={mode === 'roster' ? 'on' : ''}
						title="Pair any other user — seed or real man — with her and test the reply"
						onclick={() => (mode = 'roster')}
					>
						Pick a profile
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
				{:else if mode === 'roster'}
					<div class="fade-in">
						<div class="field" style="margin-bottom:12px">
							<label>Pick the man to role-play as her match</label>
							<ProfilePicker
								roster={rosterMen}
								gender="man"
								hideSeedDefault={false}
								selectedId={rosterMatch?.id}
								onSelect={(p) => (rosterMatch = p)}
								label="Search men — seed or real…"
							/>
						</div>
						{#if rosterMatch}
							<div style="display:flex; align-items:center; gap:8px; margin:2px 0 12px; font-size:11.5px; color:var(--text-4)">
								<span>
									{rosterMatch.is_seed ? 'Seed' : 'Real'} profile · paired ad-hoc with {sel.first_name}{rosterMatch.city ? ` · ${rosterMatch.city}` : ''}
								</span>
								<code style="opacity:.7">user_id {rosterMatch.id.slice(0, 8)}…</code>
							</div>
							<div class="field-row">
								<div class="field">
									<label>Goal</label>
									<select bind:value={rosterGoal}><option>long-term</option><option>marriage</option><option>open / serious</option><option>casual</option></select>
								</div>
							</div>
						{/if}
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
