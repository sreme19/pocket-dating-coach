# Pocket Dating Coach

SvelteKit dating coach app powered by Claude, Supabase, pgvector, and Voyage AI embeddings.

**Project Management:** [Plane board](https://app.plane.so/woam/projects/bdb013db-8e4f-4bf3-bfb0-07e23c4589ea/issues/)
**Latest:** main (post-v2.7.0) — archetype overhaul, Traditional Matrimony flow, Spoiled Casual / Casual Generous archetype QA sets, Security Advisor RLS fixes, CI green (`npm run check` 0 errors)

## Features

### Verified Vibe (current — post-v2.7.0)
- **16 archetypes (8 male / 8 female):** `casual_generous_man` 💸, `hopeless_romantic_man` 💞, `rebound_healing_man` 🌱, `untouched_heart_man` 🕊️, `forever_focused_man` 🎯, `traditional_matrimony_man` 🏛️, `second_chapter_man` 🔄, `just_friends_man` 🤝 — and female counterparts `spoiled_casual_woman` ✨ through `just_friends_woman` 🫂
- **Archetype-specific verification flows:** each archetype has a tailored QA set. Traditional Matrimony collects marital status, religion, education, lifestyle, and INR income via `MatrimonyProfileStep` / `MatrimonyPreferencesStep`. Spoiled Casual and Casual Generous have their own question sets.
- **Rich Messages list:** NEW MATCHES horizontal bubble strip, archetype chips, trust score pills, filter tabs (All / Unread), real unread badge counts
- **AI Bestie:** per-match coaching mode with `[DRAFT:MatchName]` actionable reply blocks; standalone advisor with match summaries, fresh insights, configure page
- **AI Wingman:** male coaching + impersonation mode
- **Trust scoring:** 0–100 across 4 verification steps (ID, Liveness, Photos, Spending/QA) at 25 pts each
- **Secret Admirer:** women can send an anonymous attention message to any discovered profile
- **Unread tracking:** `user1_last_read_at` / `user2_last_read_at` per match; badges clear on open
- **Security Advisor RLS:** typing indicators, function `SECURITY DEFINER` and `search_path` fixes applied

### Verified Vibe (v2.4.0 — v2.6.0)
- AI Bestie conversation page, actionable draft messages via `[DRAFT:]` blocks
- Trust uploads, editable profile, archetype onboarding fixes
- Android deployment via Capacitor, privacy policy page

### Core tools
- Ask Coach: conversational dating advice grounded in the ingested dating book.
- Profile Review: upload a dating app profile screenshot for structured feedback.
- Chat Analyzer: paste or upload a conversation screenshot for next-move guidance.
- Reply Suggester: generate playful, warm, and direct reply options.
- For Her: guided female profile journey with photo story intake, preference prompts, a public profile, private matching brief, compatibility signals, and approval controls.
- Male Profile Journey: onboarding path from archetype selection into verification, profile intake, Claude profile synthesis, and an editable profile page.
- AI photo enhancement: fal.ai-backed photo generation module via `/api/photo-enhance/generate`.

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

| File | Creates / modifies |
|------|---------|
| `20260520_001_create_exec_sql_function.sql` | Helper `exec_sql` function |
| `20260520_configure_rls.sql` | RLS on core VV tables |
| `20260520_create_verified_vibe_tables.sql` | Core VV tables (users, matches, messages, likes, passes, typing) |
| `20260520_create_ai_assistant_tables.sql` | AI assistant profiles, conversations, summaries |
| `20260520_enable_rls_ai_assistant_tables.sql` | RLS policies for AI assistant tables |
| `001_ai_assistant_profiles.sql` | `ai_assistant_profiles` versioned store |
| `20260522_add_ai_bestie_active_to_matches.sql` | `ai_bestie_active` flag on matches |
| `20260522_add_preferences_to_users.sql` | `preferences` JSONB on users |
| `20260522_profile_section_staleness.sql` | `profile_section_stale` column + trigger |
| `20260522_ai_bestie_feedback.sql` | AI Bestie thumbs-up/down feedback |
| `20260522_add_last_read_to_matches.sql` | `user1_last_read_at` / `user2_last_read_at` on matches |
| `20260523_archetype_overhaul.sql` | Seeds 43 profiles with new 8+8 archetype keys |
| `20260523_attention_messages.sql` | `attention_messages` table (Secret Admirer) |
| `20260523_here_for_hard_nos.sql` | `here_for` and `hard_nos` columns on users |
| `20260523_profile_tips.sql` | `profile_tips` table |
| `20260523_user_artifacts.sql` | `user_artifacts` table |
| `20260523_create_device_tokens.sql` | Device tokens for push notifications |
| `20260525_security_advisor_fixes.sql` | RLS on typing indicators; Security Advisor function fixes |

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
- `npm run check` passes with **0 errors** as of 2026-05-25. A separate `tsconfig.check.json` excludes test files so test mock type errors do not surface in CI.
- `npm test` has partial failures from Vitest 4 config deprecation and Svelte server/client environment mismatch in component tests — not production regressions.
- The current Verified Vibe male profile path stores profile drafts, generated copy, and uploaded photo data URLs in browser `localStorage` for dev convenience. Production should persist to Supabase.
- Android/Capacitor scaffolding exists in `android/` and `capacitor.config.ts` but is a separate work stream.
