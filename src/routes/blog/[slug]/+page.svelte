<script lang="ts">
	import Seo from '$lib/blog/Seo.svelte';
	import { BLOG_TAGLINE, blogHref, formatDate, tagLabel } from '$lib/blog/site';

	let { data } = $props();

	let href = $derived((path = '') => blogHref(data.onBlogHost, path));
	let post = $derived(data.post);
	// A contents list only earns its space on a post with real structure.
	let showToc = $derived(post.toc.length >= 3);
</script>

<Seo
	title={post.title}
	description={post.summary || BLOG_TAGLINE}
	path={`/${post.slug}`}
	image={post.cover}
	article={{ published: `${post.date}T12:00:00Z`, tags: post.tags }}
/>

<article>
	<header class="post__header">
		<h1 class="post__title">{post.title}</h1>
		{#if post.summary}
			<p class="post__summary">{post.summary}</p>
		{/if}
		<p class="postMeta">
			<time datetime={post.date}>{formatDate(post.date)}</time>
			<span class="postMeta__dot"></span>
			<span>{post.readingMinutes} min read</span>
			{#if post.draft}
				<span class="postMeta__dot"></span>
				<span class="postMeta--draft">Draft — not published</span>
			{/if}
		</p>
		<hr class="post__rule" />
	</header>

	{#if showToc}
		<details class="post__toc">
			<summary>Contents</summary>
			<ol>
				{#each post.toc as entry (entry.id)}
					<li data-depth={entry.depth}>
						<a href="#{entry.id}">{entry.text}</a>
					</li>
				{/each}
			</ol>
		</details>
	{/if}

	<!-- Compiled at build time from markdown this repo owns; no user input reaches it. -->
	<div class="prose">{@html post.html}</div>

	<footer class="post__footer">
		{#if post.tags.length}
			<ul class="tagRow">
				{#each post.tags as tag (tag)}
					<li><a class="tagChip" href={href(`/tags/${tag}`)}>{tagLabel(tag)}</a></li>
				{/each}
			</ul>
		{/if}

		{#if data.prev || data.next}
			<div class="post__neighbours">
				{#if data.prev}
					<a class="neighbour" href={href(`/${data.prev.slug}`)}>
						<span class="neighbour__label">Previous</span>
						<span class="neighbour__title">{data.prev.title}</span>
					</a>
				{/if}
				{#if data.next}
					<a class="neighbour neighbour--next" href={href(`/${data.next.slug}`)}>
						<span class="neighbour__label">Next</span>
						<span class="neighbour__title">{data.next.title}</span>
					</a>
				{/if}
			</div>
		{/if}

		<aside class="blog__product">
			<span class="blog__productLabel">What I'm building</span>
			<p class="blog__productText">
				<a href="https://www.riteangle.dating/">riteangle</a> — a dating app where an AI reads the
				room for you. This blog is my own writing and speaks only for me.
			</p>
		</aside>
	</footer>
</article>
