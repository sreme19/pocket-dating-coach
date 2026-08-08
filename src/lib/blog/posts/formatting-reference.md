---
title: Formatting reference
date: 2026-08-08
summary: Every element the blog knows how to render. Kept as a draft so it never publishes.
tags: [meta]
draft: true
---

This post exists so there is always one page exercising every element. It is
marked `draft: true`, so it shows up when running `npm run dev` and is invisible
in production — including to the feed, the sitemap, and its own URL.

## Frontmatter

Every post needs `title` and `date`. The rest are optional.

```yaml
---
title: Starting a notebook in public
date: 2026-08-08
summary: One or two lines. Used on the index and as the share description.
tags: [agentic-architecture, operations]
draft: true
cover: /og/my-card.png
---
```

The build fails loudly on a missing `title`, a missing `date`, or a date that
isn't `YYYY-MM-DD` — a broken post can't reach production quietly.

## Text

Regular prose, with **bold**, *italic*, `inline code`, and
[a link](https://www.riteangle.dating/). Outbound links open in a new tab;
internal ones don't.

> A blockquote, for when someone else said it better.
>
> It can run to a second paragraph.

- An unordered list
- With a second item
  - and something nested underneath it
- and a third

1. Ordered lists work too
2. Numbered automatically

---

## Headings build the contents list

Any post with three or more `##` or `###` headings gets a collapsible contents
box at the top. Anchors are generated from the heading text and de-duplicated, so
two sections called the same thing still get distinct links.

### A third-level heading

Indented one step in the contents list.

## Code

Fenced blocks are highlighted at build time. The language label sits in the
corner.

```typescript
type Handoff = {
	matchId: string;
	expiresAt: string;
};

export function isExpired(handoff: Handoff, now: number): boolean {
	return Date.parse(handoff.expiresAt) <= now;
}
```

```python
def reading_minutes(words: int) -> int:
    return max(1, round(words / 200))
```

```bash
npm run dev
```

```sql
select tag, count(*) as posts
from post_tags
group by tag
order by posts desc;
```

```diff
- const posts = await fetchPosts();
+ const posts = listPosts();
```

A fence with no language, or one whose language isn't loaded, renders as plain
monospace rather than failing the build:

```
just text
```

## Tables

Wide tables scroll inside their own box; the page never scrolls sideways.

| Field    | Required | Notes                                  |
| -------- | -------- | -------------------------------------- |
| `title`  | yes      | Shown on the index and in the tab      |
| `date`   | yes      | `YYYY-MM-DD`, drives ordering          |
| `summary`| no       | Falls back to the site tagline         |
| `tags`   | no       | Each one gets its own page             |
| `draft`  | no       | Dev-only when true                     |
| `cover`  | no       | Absolute path under `static/`          |

## Publishing

Write the file, commit it, push. The markdown is compiled during the Vercel
build and the CDN cache is purged on deploy, so a new post is live as soon as
the deploy finishes.
