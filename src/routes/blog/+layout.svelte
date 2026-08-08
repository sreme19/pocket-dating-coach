<script lang="ts">
	import '$lib/blog/blog.css';
	import { page } from '$app/stores';
	import { BLOG_NAME, BLOG_TAGLINE, blogHref } from '$lib/blog/site';

	let { data, children } = $props();

	let href = $derived((path = '') => blogHref(data.onBlogHost, path));
	let pathname = $derived($page.url.pathname);
	let isIndex = $derived(pathname === '/' || pathname === '/blog' || pathname === '/blog/');
	let year = new Date().getFullYear();
</script>

<div class="blog">
	<header class="blog__header">
		<div class="blog__inner">
			<div class="blog__headerRow">
				<a class="blog__wordmark" href={href()}>{BLOG_NAME}</a>
				<nav class="blog__nav">
					<a href={href()} aria-current={isIndex ? 'page' : undefined}>Writing</a>
					<a href={href('/rss.xml')}>RSS</a>
					<a href="https://www.riteangle.dating/">riteangle</a>
				</nav>
			</div>
			{#if isIndex}
				<p class="blog__tagline">{BLOG_TAGLINE}</p>
			{/if}
		</div>
	</header>

	<main class="blog__main">
		<div class="blog__inner">
			{@render children()}
		</div>
	</main>

	<footer class="blog__footer">
		<div class="blog__inner">
			<div class="blog__footerRow">
				<span>&copy; {year} {BLOG_NAME}</span>
				<span>
					<a href={href('/rss.xml')}>Subscribe by RSS</a>
				</span>
			</div>
		</div>
	</footer>
</div>
