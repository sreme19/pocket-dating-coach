import { error } from '@sveltejs/kit';
import { listTags, postsByTag } from '$lib/blog/posts.server';
import { BLOG_CACHE_CONTROL } from '$lib/blog/site';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, setHeaders }) => {
	const posts = postsByTag(params.tag);
	if (!posts.length) {
		error(404, 'No posts with that tag.');
	}

	setHeaders({ 'cache-control': BLOG_CACHE_CONTROL });
	return { tag: params.tag, posts, tags: listTags() };
};
