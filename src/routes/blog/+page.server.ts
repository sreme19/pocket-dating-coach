import { listPosts, listTags } from '$lib/blog/posts.server';
import { BLOG_CACHE_CONTROL } from '$lib/blog/site';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ setHeaders }) => {
	setHeaders({ 'cache-control': BLOG_CACHE_CONTROL });
	return { posts: listPosts(), tags: listTags() };
};
