import { dev } from '$app/environment';
import type { BlogPost, BlogPostMeta } from './types';

// Server-only on purpose (`.server.ts`): the glob pulls in every post's
// rendered HTML, and that must never be shipped to the browser as part of a
// route bundle. Pages read posts through `+page.server.ts` loads.

const modules = import.meta.glob<{ default: BlogPost }>('./posts/*.md', { eager: true });

/**
 * Newest first. Drafts are visible while running `npm run dev` so a post can be
 * read in place before it is published, and dropped from every production
 * surface — listings, tag pages, the feed, the sitemap, and direct URLs.
 */
const posts: BlogPost[] = Object.values(modules)
	.map((module) => module.default)
	.filter((post) => dev || !post.draft)
	.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title)));

function toMeta(post: BlogPost): BlogPostMeta {
	const { html: _html, toc: _toc, ...meta } = post;
	return meta;
}

export function listPosts(): BlogPostMeta[] {
	return posts.map(toMeta);
}

export function getPost(slug: string): BlogPost | null {
	return posts.find((post) => post.slug === slug) ?? null;
}

/** Every tag in use, most-used first, ties broken alphabetically. */
export function listTags(): { tag: string; count: number }[] {
	const counts = new Map<string, number>();
	for (const post of posts) {
		for (const tag of post.tags) {
			counts.set(tag, (counts.get(tag) ?? 0) + 1);
		}
	}
	return [...counts.entries()]
		.map(([tag, count]) => ({ tag, count }))
		.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function postsByTag(tag: string): BlogPostMeta[] {
	const wanted = tag.toLowerCase();
	return posts.filter((post) => post.tags.some((t) => t.toLowerCase() === wanted)).map(toMeta);
}

/**
 * Neighbours for the in-post footer. `next` is the more recent post, matching
 * the reading order of the index.
 */
export function neighbours(slug: string): { prev: BlogPostMeta | null; next: BlogPostMeta | null } {
	const index = posts.findIndex((post) => post.slug === slug);
	if (index === -1) return { prev: null, next: null };
	return {
		next: index > 0 ? toMeta(posts[index - 1]) : null,
		prev: index < posts.length - 1 ? toMeta(posts[index + 1]) : null
	};
}

export const lastUpdated: string | null = posts[0]?.date ?? null;
