<script lang="ts">
	import { formatDate } from './site';
	import type { BlogPostMeta } from './types';

	let {
		posts,
		href
	}: {
		posts: BlogPostMeta[];
		/** Builds an internal href from a blog-root-relative path. */
		href: (path?: string) => string;
	} = $props();
</script>

<ul class="postList">
	{#each posts as post (post.slug)}
		<li class="postList__item">
			<a class="postList__link" href={href(`/${post.slug}`)}>
				<h2 class="postList__title">{post.title}</h2>
				{#if post.summary}
					<p class="postList__summary">{post.summary}</p>
				{/if}
				<p class="postMeta">
					<time datetime={post.date}>{formatDate(post.date)}</time>
					<span class="postMeta__dot"></span>
					<span>{post.readingMinutes} min read</span>
					{#if post.draft}
						<span class="postMeta__dot"></span>
						<span class="postMeta--draft">Draft</span>
					{/if}
				</p>
			</a>
		</li>
	{/each}
</ul>
