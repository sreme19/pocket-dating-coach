<script lang="ts">
	import PostList from '$lib/blog/PostList.svelte';
	import Seo from '$lib/blog/Seo.svelte';
	import TagRow from '$lib/blog/TagRow.svelte';
	import { BLOG_NAME, BLOG_TAGLINE, blogHref } from '$lib/blog/site';

	let { data } = $props();

	let href = $derived((path = '') => blogHref(data.onBlogHost, path));
</script>

<Seo title={BLOG_NAME} description={BLOG_TAGLINE} />

<p class="blog__lede">
	I build AI systems and ship a dating product. These are the notes I take along the way — the
	architectures that held up, the ones that didn't, and what running the thing taught me that
	designing it never could.
</p>

<TagRow tags={data.tags} {href} />

{#if data.posts.length}
	<p class="blog__sectionLabel">All writing</p>
	<PostList posts={data.posts} {href} />
{:else}
	<p class="blog__empty">
		No posts published yet. Add a markdown file to <code>src/lib/blog/posts/</code> and it appears
		here.
	</p>
{/if}
