<script lang="ts">
	import Icon from './Icon.svelte';
	import { fullName, initials, assistantFor, avatarColor, type RosterUser } from './lib';

	let {
		roster,
		selectedId = null,
		onSelect,
		gender = undefined,
		label = 'Search by name, archetype, gender…'
	}: {
		roster: RosterUser[];
		selectedId?: string | null;
		onSelect: (p: RosterUser) => void;
		gender?: string;
		label?: string;
	} = $props();

	let q = $state('');
	let list = $derived(
		roster.filter(
			(p) =>
				(!gender || p.gender === gender) &&
				(q === '' ||
					(fullName(p) + p.archetype + p.city + p.gender).toLowerCase().includes(q.toLowerCase()))
		)
	);
</script>

<div class="picker">
	<div class="search">
		<Icon name="search" size={15} />
		<input bind:value={q} placeholder={label} />
	</div>
	<div class="roster">
		{#each list as p (p.id)}
			{@const a = assistantFor(p)}
			<button class="persona {selectedId === p.id ? 'sel' : ''}" onclick={() => onSelect(p)}>
				<div
					class="avatar"
					style="background: linear-gradient(150deg, {avatarColor(p)}, {avatarColor(p)}cc)"
				>
					{initials(p)}
				</div>
				<div class="persona-main">
					<div class="persona-name">
						{fullName(p)}
						{#if !p.in_pool}<span class="badge amber">not in pool</span>{/if}
					</div>
					<div class="persona-meta">{p.archetype} · {p.age} · {p.city}</div>
				</div>
				<span class="assistant-tag {a}">{a === 'bestie' ? 'Bestie' : 'Wingman'}</span>
			</button>
		{/each}
		{#if list.length === 0}
			<div style="padding:16px; text-align:center; color:var(--text-4); font-size:12.5px;">
				No profiles match.
			</div>
		{/if}
	</div>
</div>
