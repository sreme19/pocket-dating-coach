<script lang="ts">
	import PostList from '$lib/blog/PostList.svelte';
	import Seo from '$lib/blog/Seo.svelte';
	import TagRow from '$lib/blog/TagRow.svelte';
	import { blogHref, tagLabel } from '$lib/blog/site';

	let { data } = $props();

	let href = $derived((path = '') => blogHref(data.onBlogHost, path));
	let label = $derived(tagLabel(data.tag));
	let count = $derived(data.posts.length);
</script>

<Seo
	title={label}
	description={`${count} ${count === 1 ? 'post' : 'posts'} tagged ${label}.`}
	path={`/tags/${data.tag}`}
/>

<TagRow tags={data.tags} active={data.tag} {href} />

<p class="blog__sectionLabel">{label} — {count} {count === 1 ? 'post' : 'posts'}</p>
<PostList posts={data.posts} {href} />
