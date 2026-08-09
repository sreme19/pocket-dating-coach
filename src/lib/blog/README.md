# Sree's personal blog

A personal writing surface hosted on a subdomain of the riteangle domain. It is
**not** product surface: separate origin, separate design system, its own feed.
Nothing here reads the database, and no product code imports from this folder.

- **Canonical URL:** `https://sree.riteangle.dating`
- **Routes:** `src/routes/blog/` (served at the subdomain root — see below)
- **Content:** `src/lib/blog/posts/*.md`

## Publishing a post

1. Add `src/lib/blog/posts/my-slug.md`. The filename becomes the URL.
2. Give it frontmatter — `title` and `date` are required:

   ```yaml
   ---
   title: My post
   date: 2026-08-09
   summary: One or two lines, used on the index and as the share description.
   tags: [agentic-architecture]
   draft: true
   ---
   ```

3. Preview it with `npm run dev` at `http://localhost:5173/blog`. Drafts are
   visible in dev and hidden everywhere else.
4. Delete `draft: true`, commit, push. Live when the deploy finishes.

`src/lib/blog/posts/formatting-reference.md` is a permanent draft demonstrating
every element that renders. Open it in dev when in doubt.

## How it's built

Markdown is compiled to HTML **at build time** by a Vite plugin
(`scripts/vite-plugin-blog.ts`) using `marked` for the parse and `shiki` for
syntax highlighting. Both are devDependencies on purpose: the plugin emits plain
data, so neither library ends up in the serverless function or the browser
bundle. A post costs nothing to serve beyond the bytes of its own HTML.

Posts are read through `posts.server.ts` — server-only, so no route bundle ever
ships every post's HTML to the client.

## How the subdomain works

The routes live under `/blog`, and `src/hooks.ts` rewrites requests arriving on a
hostname listed in `BLOG_HOSTS` so that `sree.riteangle.dating/my-post` resolves
to the `/blog/my-post` route. Readers never see `/blog` in the URL.

Pages are deliberately **not** prerendered. Vercel serves prerendered files from
its static layer before a request reaches the SvelteKit function, which is where
that rewrite lives — prerendering would break the subdomain. Instead each load
sets `BLOG_CACHE_CONTROL`, so the CDN caches pages for an hour and Vercel purges
it on every deploy.

### Hostnames

This blog is served ONLY on `sree.riteangle.dating`, where `reroute` in
`src/hooks.ts` maps `/my-post` onto these `/blog/my-post` routes. It is live.

`/blog` on `riteangle.dating` and `www.riteangle.dating` returns **404** by
design — see the guard in `src/hooks.server.ts`. That path belongs to
riteangle's own writing, which is a separate publication with separate content.
Do not "fix" this by redirecting `/blog` to the subdomain: the two sites are
unrelated, and a redirect would fold this personal blog into the product site.

The 404 is scoped to those two production hostnames, so `/blog` stays browsable
on `localhost` and on Vercel preview URLs, which is how posts are reviewed
before they ship.

## Local subdomain testing

Optional. Add to `/etc/hosts`:

```
127.0.0.1 sree.localhost
```

Then browse `http://sree.localhost:5173/` to exercise the rewrite. Otherwise just
use `/blog`.
