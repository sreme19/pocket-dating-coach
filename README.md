# Pocket Dating Coach

SvelteKit dating coach app powered by Claude, Supabase, pgvector, and Voyage AI embeddings.

**Project Management:** [Plane board](https://app.plane.so/woam/projects/bdb013db-8e4f-4bf3-bfb0-07e23c4589ea/issues/)
**Latest release:** [v2.2.0 — Verified Vibe Messaging UX](https://github.com/sreme19/pocket-dating-coach/releases/tag/v2.2.0)

## Features

### Verified Vibe (v2.2.0 — current)
- **Rich Messages list:** NEW MATCHES horizontal bubble strip, archetype chips (🎯💍💎🛡️), trust score pills, filter tabs (All / Unread), real unread badge counts
- **AI Bestie chat:** markdown-rendered responses (bold, bullets, emoji), thumbs-up/down feedback stored in DB, sparkle toggle button with pink–purple gradient
- **Unread tracking:** per-conversation `last_read_at` timestamps; badge clears the moment Neha opens a chat
- **AI Bestie tone:** give-and-take conversational style — appreciates the guy, shares about Neha, asks open non-leading questions, defaults to ✅ signal

### Verified Vibe (v2.1.0)
- AI Bestie: match advisor chat with match summaries, fresh insights, configure page with per-item deletion
- Rich match profile view: personality trait bars, archetype chips, "What He Brings", "Here For" sections
- BestieAvatar: confident flat-vector SVG illustration with layered golden stars

### Core tools
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

### Verified Vibe tables (apply in order via SQL editor)

All migration files live in `supabase/migrations/`. Apply them in filename order:

| File | Creates |
|------|---------|
| `20260520_create_verified_vibe_tables.sql` | Core VV tables (users, matches, messages, likes, passes, typing) |
| `20260520_create_ai_assistant_tables.sql` | AI assistant profiles, conversations, summaries |
| `20260520_enable_rls_ai_assistant_tables.sql` | RLS policies for AI assistant tables |
| `001_ai_assistant_profiles.sql` | `ai_assistant_profiles` versioned store |
| `20260522_add_ai_bestie_active_to_matches.sql` | `ai_bestie_active` flag on matches |
| `20260522_add_preferences_to_users.sql` | `preferences` JSONB on users |
| `20260522_profile_section_staleness.sql` | `profile_section_stale` column + trigger |
| `20260523_create_device_tokens.sql` | Device tokens for push notifications |
| `20260522_ai_bestie_feedback.sql` | AI Bestie thumbs-up/down feedback |
| `20260522_add_last_read_to_matches.sql` | Per-user `last_read_at` for unread counts |

See `supabase/migrations/KIRO_SUPABASE_HANDOFF.md` for full SQL, RLS policies, verification queries, and rollback statements for every migration.

### Legacy tables (original coaching tools)

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

## Key API Routes (Verified Vibe)

| Route | Purpose |
|-------|---------|
| `GET /api/verified-vibe/chat/conversations` | Chat list with unread counts, archetype, trust score |
| `POST /api/verified-vibe/chat/mark-read` | Clear unread badge when conversation is opened |
| `POST /api/verified-vibe/ai-bestie/chat` | AI Bestie advisor chat (summary / insights / freeform) |
| `POST /api/verified-vibe/ai-bestie/generate-response` | In-chat AI Bestie analysis + suggested reply |
| `POST /api/verified-vibe/ai-bestie/feedback` | Store 👍/👎 rating on a Bestie response |
| `POST /api/verified-vibe/ai-bestie/opening-message` | Generate a first message to a new match |
| `GET /api/verified-vibe/match-profile/[id]` | Rich profile: trait scores, vibe words, archetype |
| `GET /api/ai-bestie/configure` | Load structured preference probes |
| `DELETE /api/ai-bestie/configure` | Remove a single preference item |

## Notes

- `npm run ingest` loads the dating book into Supabase using Voyage AI embeddings.
- The female journey keeps public profile output separate from private matching notes and raw preference inputs.
- The app currently uses a stable anonymous browser session ID. Full Supabase Auth is a planned next step.
- The current Verified Vibe male profile path intentionally includes a dev-mode auth bypass and stores profile drafts, generated copy, uploaded photo data URLs, and AI photo results in browser `localStorage`.
- As of the profile generation commit, `npm run check` and `npm test` are not green. Known failures include pre-existing Svelte/type/test issues and `@fal-ai/client` API typing errors in the new photo enhancement module.
- Android/Capacitor scaffolding exists in the repo (`android/`, `capacitor.config.ts`) but is a separate work stream — do not merge into Verified Vibe feature branches.
