<script lang="ts">
	import Icon from './Icon.svelte';
	import ProfilePicker from './ProfilePicker.svelte';
	import TracePanel from './TracePanel.svelte';
	import Gauge from './Gauge.svelte';
	import { type RosterUser, type AgentTrace } from './lib';

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

	type Result = {
		hardFilter: { excluded: boolean; reasons: { ok: boolean; text: string }[] };
		softScore: { score: number; rationale: string; flags: { color: string; text: string }[] };
		maleInPool: boolean;
		femaleInPool: boolean;
		cached: boolean;
		claudeCalls: number;
		trace: AgentTrace | null;
	};

	let male = $state<RosterUser | null>(null);
	let female = $state<RosterUser | null>(null);
	let result = $state<Result | null>(null);
	let scoring = $state(false);
	let error = $state('');
	let warming = $state(false);
	let warmMsg = $state('');

	function reset() {
		result = null;
		error = '';
		setTrace(null);
	}
	let canScore = $derived(!!(male && female));
	let poolGap = $derived(canScore && (!male!.in_pool || !female!.in_pool));

	function flagColor(c: string) {
		return c === 'green' ? 'var(--emerald)' : c === 'yellow' ? 'var(--amber)' : 'var(--rose-strong)';
	}

	async function score() {
		if (!canScore || poolGap || !male || !female) return;
		scoring = true;
		result = null;
		error = '';
		setTrace(null);
		try {
			const res = await fetch('/admin/test-suite/api/matchmaker', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ maleId: male.id, femaleId: female.id, persist })
			});
			const data = (await res.json()) as Result & { error?: string };
			if (!res.ok) throw new Error(data.error || 'request failed');
			result = data;
			setTrace(data.trace);
		} catch (e) {
			error = e instanceof Error ? e.message : 'request failed';
		} finally {
			scoring = false;
		}
	}

	async function warm() {
		warming = true;
		warmMsg = '';
		try {
			const res = await fetch('/admin/test-suite/api/warm-matrix', { method: 'POST' });
			const d = await res.json();
			if (!res.ok) throw new Error(d.error || 'warm failed');
			warmMsg = `Warmed: ${d.scoredNow} scored now · ${d.alreadyCached} already cached · ${d.remaining} remaining · ${d.claudeCalls} Claude calls.`;
		} catch (e) {
			warmMsg = e instanceof Error ? e.message : 'warm failed';
		} finally {
			warming = false;
		}
	}
</script>

<div class="case-grid">
	<div class="case-left">
		<div class="card card-pad">
			<div class="eyebrow" style="margin-bottom:14px">Score a pair</div>
			<div class="mm-pickers">
				<div>
					<div class="field-label"><Icon name="user" size={11} color="var(--indigo)" /> Male user · vv_pool_wingmen</div>
					<ProfilePicker {roster} gender="man" selectedId={male?.id} onSelect={(p) => { male = p; reset(); }} label="Search men…" />
				</div>
				<div>
					<div class="field-label"><Icon name="user" size={11} color="var(--rose)" /> Female user · vv_pool_besties</div>
					<ProfilePicker {roster} gender="woman" selectedId={female?.id} onSelect={(p) => { female = p; reset(); }} label="Search women…" />
				</div>
			</div>

			{#if poolGap && male && female}
				<div class="notpool" style="margin-top:16px">
					<Icon name="alert" size={18} />
					<div>
						<div class="t">Not in pool</div>
						<div class="d">
							{[!male.in_pool ? male.first_name : null, !female.in_pool ? female.first_name : null].filter(Boolean).join(' & ')}
							{!male.in_pool && !female.in_pool ? 'are' : 'is'} not enrolled in a Matchmaker pool. Run
							<code>refreshPoolEntry(userId)</code> first to distill their profile.
						</div>
					</div>
				</div>
			{/if}

			{#if error}
				<div class="errbox" style="margin-top:16px"><Icon name="alert" size={16} /><span>{error}</span></div>
			{/if}

			<button class="scorepair-btn" onclick={score} disabled={!canScore || poolGap || scoring}>
				{#if scoring}<Icon name="clock" size={17} spin /> Scoring…{:else}<Icon name="zap" size={16} /> Score pair{/if}
			</button>

			<div class="divider"></div>
			<div class="secondary-controls" style="margin-top:0; align-items:center">
				<button class="ghost-btn" onclick={warm} disabled={warming}>
					{#if warming}<Icon name="clock" size={14} spin /> Warming…{:else}<Icon name="zap" size={14} /> Warm the matrix{/if}
					<span class="spend"><Icon name="alert" size={11} />pre-scores uncached pairs</span>
				</button>
				{#if warmMsg}<span style="font-size:11.5px; color:var(--text-3)">{warmMsg}</span>{/if}
			</div>
		</div>

		{#if result && result.trace}
			<div class="card card-pad fade-in">
				<div class="result-grid">
					<div class="hardfilter {result.hardFilter.excluded ? 'fail' : 'pass'}">
						<div class="hf-head">
							<Icon name={result.hardFilter.excluded ? 'ban' : 'shield'} size={18} color={result.hardFilter.excluded ? 'var(--rose)' : 'var(--emerald)'} />
							<span class="hf-verdict {result.hardFilter.excluded ? 'fail' : 'pass'}">{result.hardFilter.excluded ? 'Excluded' : 'Passes hard filter'}</span>
						</div>
						<div class="hf-reasons">
							{#each result.hardFilter.reasons as r}
								<div class="hf-reason">
									<Icon name={r.ok ? 'check' : 'x'} size={14} color={r.ok ? 'var(--emerald)' : 'var(--rose)'} />
									<span>{r.text}</span>
								</div>
							{/each}
						</div>
					</div>
					<div class="card gauge-card" style="background:var(--bg-2)">
						<Gauge value={result.softScore.score} />
						<div class="flags" style="width:100%">
							{#each result.softScore.flags as f}
								<div class="flag">
									<span class="flag-dot" style="background:{flagColor(f.color)}"></span>
									<span>{f.text}</span>
								</div>
							{/each}
						</div>
					</div>
				</div>
				<div class="rationale"><span class="ql">“</span>{result.softScore.rationale}</div>

				<div style="margin-top:14px; display:flex; align-items:center; gap:8px; font-size:11.5px; color:var(--text-3)">
					<span class="badge {result.cached ? 'sky' : 'emerald'}">
						<Icon name={result.cached ? 'check' : 'zap'} size={11} />{result.cached ? 'served from cache' : 'freshly scored + cached'}
					</span>
					<span>Claude calls this run: <strong style="color:var(--text-2)">{result.claudeCalls}</strong>{result.cached ? ' (served from ts_pair_scores)' : ''}</span>
				</div>

				<div class="divider"></div>
				<div class="eyebrow" style="margin-bottom:10px">On-demand reports · read-only · persist: off</div>
				<div class="secondary-controls">
					<button class="ghost-btn" disabled>
						<Icon name="sliders" size={14} />Per-match ranking ({male?.first_name})
						<span class="spend"><Icon name="alert" size={11} />~20 Claude calls</span>
					</button>
					<button class="ghost-btn" disabled>
						<Icon name="book" size={14} />Competitive report ({female?.first_name})
						<span class="spend"><Icon name="alert" size={11} />spend warning</span>
					</button>
				</div>
			</div>
		{/if}
	</div>
	<TracePanel {trace} />
</div>
