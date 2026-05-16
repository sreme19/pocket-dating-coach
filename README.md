# Pocket Dating Coach

SvelteKit dating coach app powered by Claude, Supabase, pgvector, and Voyage AI embeddings.

## Features

- Ask Coach: conversational dating advice grounded in the ingested dating book.
- Profile Review: upload a dating app profile screenshot for structured feedback.
- Chat Analyzer: paste or upload a conversation screenshot for next-move guidance.
- Reply Suggester: generate playful, warm, and direct reply options.
- For Her: guided female profile journey with photo story intake, preference prompts, a public profile, private matching brief, compatibility signals, and approval controls.

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
```

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
```

## Notes

- `npm run ingest` loads the dating book into Supabase using Voyage AI embeddings.
- The female journey keeps public profile output separate from private matching notes and raw preference inputs.
- The app currently uses a stable anonymous browser session ID. Full Supabase Auth is a planned next step.
