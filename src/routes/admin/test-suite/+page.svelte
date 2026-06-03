<script lang="ts">
	import './test-suite.css';
	import { onMount } from 'svelte';
	import Icon from './Icon.svelte';
	import Case1 from './Case1.svelte';
	import Case2 from './Case2.svelte';
	import Case3 from './Case3.svelte';
	import History from './History.svelte';
	import type { AgentTrace } from './lib';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const TABS = [
		{ id: 1, title: 'Individual assistant', desc: 'Advisor chat · Bestie or Wingman' },
		{ id: 2, title: 'Bestie in match chat', desc: 'On-her-behalf reply + coaching' },
		{ id: 3, title: 'Matchmaker', desc: 'Hard-filter + soft-score a pair' },
		{ id: 4, title: 'History', desc: 'Past runs · ts_runs' }
	];

	let tab = $state(1);
	let trace = $state<AgentTrace | null>(null);
	let persist = $state(false);

	// honor ?tab=<n> on load so a shared deep link (e.g. ?tab=4&run=<id>) lands on the right tab
	onMount(() => {
		const t = Number(new URLSearchParams(location.search).get('tab'));
		if (t >= 1 && t <= 4) tab = t;
	});

	function switchTab(id: number) {
		tab = id;
		trace = null;
	}
	function setTrace(t: AgentTrace | null) {
		trace = t;
	}
</script>

<svelte:head>
	<link
		href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="ts-root">
	<main class="page">
		<div class="page-head">
			<div class="page-title-wrap">
				<h1 class="page-title"><Icon name="flask" size={22} color="var(--emerald)" />Test Suite</h1>
				<p class="page-sub">
					Load any user's assistant with the <strong style="color:var(--text-2)">exact production</strong>
					knowledge base, prompts &amp; connections at <code>/admin/test-suite</code>. Drive it, read the
					reply the real owner/match would get, and inspect every background step. Runs are
					<strong style="color:var(--text-2)">side-effect-free</strong> by default.
				</p>
			</div>
			<div class="persist">
				<button
					class="toggle {persist ? 'on' : ''}"
					onclick={() => (persist = !persist)}
					aria-label="toggle persist"
				></button>
				<div class="persist-label">
					Persist this run<span class="muted">{persist ? 'writes to ts_runs sandbox' : 'off · ephemeral'}</span>
				</div>
			</div>
		</div>

		{#if data.loadError}
			<div class="errbox" style="margin-bottom:20px">
				<Icon name="alert" size={16} />
				<span>Couldn't load the roster: {data.loadError}</span>
			</div>
		{/if}

		<div class="tabbar">
			{#each TABS as t}
				<button class="tab {tab === t.id ? 'active' : ''}" onclick={() => switchTab(t.id)}>
					<span class="tab-num">{String(t.id).padStart(2, '0')}</span>
					<span class="tab-text">
						<span class="tab-title">{t.title}</span>
						<span class="tab-desc">{t.desc}</span>
					</span>
				</button>
			{/each}
		</div>

		{#if tab === 1}
			<Case1 roster={data.roster} {trace} {setTrace} {persist} />
		{:else if tab === 2}
			<Case2 roster={data.roster} {trace} {setTrace} {persist} />
		{:else if tab === 3}
			<Case3 roster={data.roster} {trace} {setTrace} {persist} />
		{:else if tab === 4}
			<History {trace} {setTrace} />
		{/if}
	</main>
</div>
