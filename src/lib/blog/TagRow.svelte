<script lang="ts">
	import { tagLabel } from './site';

	let {
		tags,
		active = null,
		href
	}: {
		tags: { tag: string; count: number }[];
		active?: string | null;
		href: (path?: string) => string;
	} = $props();
</script>

{#if tags.length}
	<ul class="tagRow">
		<li>
			<a class="tagChip" {...active === null ? { 'aria-current': 'page' } : {}} href={href()}>
				All
			</a>
		</li>
		{#each tags as { tag, count } (tag)}
			<li>
				<a
					class="tagChip"
					{...active === tag ? { 'aria-current': 'page' } : {}}
					href={href(`/tags/${tag}`)}
				>
					{tagLabel(tag)}
					<span class="tagChip__count">{count}</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}
