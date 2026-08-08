// Markdown files under src/lib/blog/posts are transformed into modules whose
// default export is a compiled BlogPost (see scripts/vite-plugin-blog.ts).
declare module '*.md' {
	const post: import('./types').BlogPost;
	export default post;
}
