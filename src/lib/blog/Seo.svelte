<script lang="ts">
	import { BLOG_DEFAULT_COVER, BLOG_NAME, absolute } from './site';

	let {
		title,
		description,
		/** Path relative to the blog root, e.g. `/my-post`. */
		path = '',
		image = null,
		article = null
	}: {
		title: string;
		description: string;
		path?: string;
		image?: string | null;
		article?: { published: string; tags: string[] } | null;
	} = $props();

	// Canonical URLs always point at the blog's own origin, never at whichever
	// host happened to serve the request. That is what keeps one post from being
	// indexed twice under two hostnames.
	let canonical = $derived(absolute(path || '/'));
	let cardImage = $derived(absolute(image ?? BLOG_DEFAULT_COVER));
	let fullTitle = $derived(path ? `${title} — ${BLOG_NAME}` : title);
</script>

<svelte:head>
	<title>{fullTitle}</title>
	<meta name="description" content={description} />
	<meta name="author" content={BLOG_NAME} />
	<link rel="canonical" href={canonical} />

	<meta property="og:type" content={article ? 'article' : 'website'} />
	<meta property="og:site_name" content={BLOG_NAME} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={cardImage} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={cardImage} />

	{#if article}
		<meta property="article:published_time" content={article.published} />
		<meta property="article:author" content={BLOG_NAME} />
		{#each article.tags as tag (tag)}
			<meta property="article:tag" content={tag} />
		{/each}
	{/if}
</svelte:head>
