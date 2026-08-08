import { listPosts, listTags } from '$lib/blog/posts.server';
import { BLOG_CACHE_CONTROL, absolute } from '$lib/blog/site';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ setHeaders }) => {
	const posts = listPosts();

	const urls = [
		{ loc: absolute('/'), lastmod: posts[0]?.date, priority: '1.0' },
		...posts.map((post) => ({
			loc: absolute(`/${post.slug}`),
			lastmod: post.date,
			priority: '0.8'
		})),
		...listTags().map(({ tag }) => ({
			loc: absolute(`/tags/${tag}`),
			lastmod: posts[0]?.date,
			priority: '0.4'
		}))
	];

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
	.map(
		({ loc, lastmod, priority }) => `	<url>
		<loc>${loc}</loc>${lastmod ? `\n		<lastmod>${lastmod}</lastmod>` : ''}
		<priority>${priority}</priority>
	</url>`
	)
	.join('\n')}
</urlset>
`;

	setHeaders({
		'content-type': 'application/xml; charset=utf-8',
		'cache-control': BLOG_CACHE_CONTROL
	});

	return new Response(body);
};
