import { getPost, listPosts } from '$lib/blog/posts.server';
import {
	BLOG_CACHE_CONTROL,
	BLOG_NAME,
	BLOG_ORIGIN,
	BLOG_TAGLINE,
	absolute
} from '$lib/blog/site';
import type { RequestHandler } from './$types';

// Feed URLs are absolute against BLOG_ORIGIN regardless of which host served
// the request, so a reader that subscribes from any hostname still follows items
// to the canonical one.

function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/** Wrap rendered HTML for a feed reader, neutralising any nested CDATA close. */
function cdata(html: string): string {
	return `<![CDATA[${html.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

function rfc822(date: string): string {
	return new Date(`${date}T12:00:00Z`).toUTCString();
}

export const GET: RequestHandler = ({ setHeaders }) => {
	const posts = listPosts();

	const items = posts
		.map((meta) => {
			const url = absolute(`/${meta.slug}`);
			const body = getPost(meta.slug)?.html ?? '';
			return `		<item>
			<title>${escapeXml(meta.title)}</title>
			<link>${escapeXml(url)}</link>
			<guid isPermaLink="true">${escapeXml(url)}</guid>
			<pubDate>${rfc822(meta.date)}</pubDate>
			<dc:creator>${escapeXml(BLOG_NAME)}</dc:creator>
${meta.summary ? `			<description>${escapeXml(meta.summary)}</description>\n` : ''}${meta.tags.map((tag) => `			<category>${escapeXml(tag)}</category>`).join('\n')}
			<content:encoded>${cdata(body)}</content:encoded>
		</item>`;
		})
		.join('\n');

	const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
	<channel>
		<title>${escapeXml(BLOG_NAME)}</title>
		<link>${BLOG_ORIGIN}</link>
		<description>${escapeXml(BLOG_TAGLINE)}</description>
		<language>en</language>
		<atom:link href="${absolute('/rss.xml')}" rel="self" type="application/rss+xml" />
${posts[0] ? `		<lastBuildDate>${rfc822(posts[0].date)}</lastBuildDate>\n` : ''}${items}
	</channel>
</rss>
`;

	setHeaders({
		'content-type': 'application/rss+xml; charset=utf-8',
		'cache-control': BLOG_CACHE_CONTROL
	});

	return new Response(feed);
};
