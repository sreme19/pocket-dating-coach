import { error } from '@sveltejs/kit';
import { getPost, neighbours } from '$lib/blog/posts.server';
import { BLOG_CACHE_CONTROL } from '$lib/blog/site';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, setHeaders }) => {
	const post = getPost(params.slug);
	if (!post) {
		error(404, 'That post does not exist.');
	}

	setHeaders({ 'cache-control': BLOG_CACHE_CONTROL });
	return { post, ...neighbours(post.slug) };
};
