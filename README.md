# Pocket Dating Coach

SvelteKit dating coach app powered by Claude, Supabase, pgvector, and Voyage AI embeddings.

**Project Management:** [Plane board](https://app.plane.so/woam/projects/bdb013db-8e4f-4bf3-bfb0-07e23c4589ea/issues/)

## Features

- Ask Coach: conversational dating advice grounded in the ingested dating book.
- Profile Review: upload a dating app profile screenshot for structured feedback.
- Chat Analyzer: paste or upload a conversation screenshot for next-move guidance.
- Reply Suggester: generate playful, warm, and direct reply options.
- For Her: guided female profile journey with photo story intake, preference prompts, a public profile, private matching brief, compatibility signals, and approval controls.
- Verified Vibe profile generation: a local dev onboarding path from archetype selection into verification, profile intake, Claude profile synthesis, and an editable profile page.
- AI photo enhancement foundation: fal.ai-backed photo generation module and `/api/photo-enhance/generate` endpoint for creating role-based profile photos from a reference upload.

## Local Setup

```sh
npm install
cp .env.example .env.local
npm run dev
```

Open `http://127.0.0.1:5173/`.

## Environment

Set these in `.env.local` and your deployment environment:

```sh
ANTHROPIC_API_KEY=sk-ant-api03-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
VOYAGE_API_KEY=pa-...
FAL_KEY=...
```

`FAL_KEY` is required only for AI photo enhancement. Run `npm run setup:fal` for an interactive local setup helper.

## Supabase Setup

Run `supabase-schema.sql` in the Supabase SQL editor. It creates:

- `book_chunks` and `match_book_chunks` for pgvector book retrieval.
- `female_profiles` for anonymous female journey sessions.
- `female_profile_photos` for photo story metadata.
- `female_profile_answers` for profile and preference chat answers.
- `female_generated_profiles` for generated public/private profile outputs.
- `female_profile_audit_events` for save and approval audit trail.
- `profile-uploads` storage bucket for future file storage.

The current female journey saves through `/api/female-profile` and falls back to local device storage when Supabase is unavailable.

## Scripts

```sh
npm run dev
npm run check
npm run build
npm run ingest
npm run setup:fal
```

## Documentation

Project notes and implementation artifacts live in [`docs/`](docs/README.md):

- [`docs/verified-vibe/`](docs/verified-vibe/) for Verified Vibe guides and summaries.
- [`docs/deployment/`](docs/deployment/) for deployment and production readiness.
- [`docs/reports/`](docs/reports/) for testing, accessibility, and verification reports.
- [`docs/tasks/`](docs/tasks/) for task completion notes.
- [`docs/verified-vibe/GITHUB_WIKI.md`](docs/verified-vibe/GITHUB_WIKI.md) for the GitHub Wiki-ready Verified Vibe profile generation guide.

## Notes

- `npm run ingest` loads the dating book into Supabase using Voyage AI embeddings.
- The female journey keeps public profile output separate from private matching notes and raw preference inputs.
- The app currently uses a stable anonymous browser session ID. Full Supabase Auth is a planned next step.
- The current Verified Vibe male profile path intentionally includes a dev-mode auth bypass and stores profile drafts, generated copy, uploaded photo data URLs, and AI photo results in browser `localStorage`.
- As of the profile generation commit, `npm run check` and `npm test` are not green. Known failures include pre-existing Svelte/type/test issues and `@fal-ai/client` API typing errors in the new photo enhancement module.
