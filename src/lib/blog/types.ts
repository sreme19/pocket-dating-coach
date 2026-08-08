// Shape emitted by the build-time markdown compiler in
// scripts/vite-plugin-blog.ts. Keep the two in step.

export type TocEntry = {
	depth: number;
	id: string;
	text: string;
};

export type BlogPost = {
	/** Filename without .md — the URL segment. */
	slug: string;
	title: string;
	/** YYYY-MM-DD, validated at build time. */
	date: string;
	summary: string;
	tags: string[];
	/** Drafts are listed in dev and hidden in production. */
	draft: boolean;
	/** Absolute path under /static, used for the share card. */
	cover: string | null;
	readingMinutes: number;
	wordCount: number;
	toc: TocEntry[];
	html: string;
};

/** A post without its rendered body — everything a listing needs. */
export type BlogPostMeta = Omit<BlogPost, 'html' | 'toc'>;
