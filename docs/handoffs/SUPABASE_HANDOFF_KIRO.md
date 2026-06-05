# Supabase Handoff — AI Assistant Profiles Table

**To:** Kiro  
**From:** Engineering  
**Date:** 2026-05-22  
**Repo:** `sreme19/pocket-dating-coach`  
**Urgency:** Required before AI Bestie preferences go live  

---

## Context

We've shipped the AI Bestie coaching feature. It evaluates a male match's messages and generates coaching cards + follow-up questions for the female user.

To make AI Bestie smarter over time, we've built a **preferences profile system** that stores what each female user values, her firm boundaries, and her dealbreakers — structured and versioned in the database. The app code is fully written and deployed to `main`. The only missing piece is the Supabase table itself.

**Nothing breaks without this table** — the app falls back gracefully to raw profile text. But until the table exists, AI Bestie can't learn from users' conversations and preferences won't persist.

---

## What You Need to Do

Three steps. Total time: ~5 minutes.

---

### Step 1 — Run the migration SQL in Supabase

Go to your Supabase project → **SQL Editor** → **New query**, paste and run:

```sql
-- Migration: Create ai_assistant_profiles table
-- Stores versioned AI coaching profiles for users
-- preferences -> female users
-- personality -> male users (future use)
-- Design: append-only version history. Always read with ORDER BY version DESC LIMIT 1

CREATE TABLE IF NOT EXISTS ai_assistant_profiles (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_type text        NOT NULL CHECK (profile_type IN ('preferences', 'personality')),
  data         jsonb       NOT NULL DEFAULT '{}',
  version      integer     NOT NULL DEFAULT 1,
  reason       text        NOT NULL DEFAULT 'Initial profile',
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup: user + type + latest version
CREATE INDEX IF NOT EXISTS idx_ai_assistant_profiles_user_type_version
  ON ai_assistant_profiles (user_id, profile_type, version DESC);

-- Row Level Security
ALTER TABLE ai_assistant_profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own profiles
-- Server-side code uses the service key (bypasses RLS)
CREATE POLICY "Users can read own profiles" ON ai_assistant_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profiles" ON ai_assistant_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

---

### Step 2 — Verify the table was created

Still in the SQL editor, run this verification query:

```sql
-- Should return 1 row describing the table
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'ai_assistant_profiles';

-- Should return 2 policies
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'ai_assistant_profiles';

-- Should return 1 index
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'ai_assistant_profiles';
```

Expected output:

| Check | Expected |
|-------|----------|
| Table exists | 1 row: `ai_assistant_profiles / BASE TABLE` |
| Policies | 2 rows: `Users can read own profiles` (SELECT) and `Users can insert own profiles` (INSERT) |
| Index | 1 row: `idx_ai_assistant_profiles_user_type_version` |

---

### Step 3 — Seed existing female users

Once the table exists, run this from the repo root to backfill preferences for all existing female users (Neha and any other seed accounts):

```bash
npx tsx --env-file=.env.local scripts/seed-existing-preferences.ts
```

Expected output:
```
🌱 Seeding AI assistant preferences for existing female users...
Found 2 female users to process.
✅ Seeded neha_nri_diaspora_x5r2vd (spoilt_woman)
✅ Seeded [other female seed user] (safety_first_woman)

Done. 2 seeded | 0 skipped | 0 errors
```

The script is idempotent — running it multiple times is safe (it skips users who already have a preferences entry).

---

## Table Schema Reference

```
ai_assistant_profiles
├── id           uuid         PRIMARY KEY (auto-generated)
├── user_id      uuid         FK → auth.users.id (CASCADE DELETE)
├── profile_type text         'preferences' | 'personality'
├── data         jsonb        The actual profile payload (see shape below)
├── version      integer      Increments on every update (1, 2, 3 ...)
├── reason       text         Human-readable reason for this version
└── created_at   timestamptz  Row creation timestamp
```

### `data` shape for `profile_type = 'preferences'` (female users)

```json
{
  "emotionalSignals": ["string", "..."],
  "lifestyleSignals": ["string", "..."],
  "maturitySignals":  ["string", "..."],
  "boundaries":       ["string", "..."],
  "dealbreakers":     ["string", "..."],
  "privateCompatibilityNotes": ["string", "..."],
  "updatedAt":        1748000000000
}
```

### `data` shape for `profile_type = 'personality'` (male users, future use)

```json
{
  "communicationStyle": "string",
  "personalityVibe":    "string",
  "mattersMost":        "string",
  "values":             ["string", "..."],
  "datingPatterns":     ["string", "..."],
  "redFlagsToAvoid":    ["string", "..."],
  "updatedAt":          1748000000000
}
```

---

## How the Table Is Used (for context)

| Event | What happens |
|-------|-------------|
| Female user saves profile (onboarding or update) | `POST /api/verified-vibe/preferences/initialize` is called — seeds a v1 entry from her archetype if none exists |
| Female user sends a chat message | `extractAndUpdatePreferences()` fires in background — Claude extracts any explicit dealbreakers/signals from her message, merges into new version |
| AI Bestie evaluates Adrian's message | `loadPreferences(userId)` reads the latest version — included in Claude's prompt so it evaluates him against her actual stated preferences |

**Version history is append-only.** Each change creates a new row with an incremented `version`. The latest is always fetched with `ORDER BY version DESC LIMIT 1`. Old versions are never deleted — full audit trail preserved.

---

## Access Pattern

All server-side code uses `SUPABASE_SERVICE_KEY` (bypasses RLS). The RLS policies only matter for direct client-side Supabase queries, which we do not use for this table.

The service key is already in `.env.local` and the production environment — no new secrets needed.

---

## Rollback

If anything needs to be undone:

```sql
-- Completely removes the table and all data
DROP TABLE IF EXISTS ai_assistant_profiles CASCADE;
```

This will not affect any other tables. The app will fall back gracefully to using raw `about`/`looking` text from `verified_vibe_users`.

---

## Files in the Repo (for reference)

| File | Purpose |
|------|---------|
| `supabase/migrations/001_ai_assistant_profiles.sql` | The migration SQL (same as Step 1 above) |
| `scripts/seed-existing-preferences.ts` | One-time seed script (Step 3) |
| `src/lib/server/preferences-initializer.ts` | Archetype → PreferencesProfile seed logic |
| `src/lib/server/profile-service.ts` | loadPreferences / updatePreferences functions |
| `src/routes/api/verified-vibe/preferences/initialize/+server.ts` | Initialize endpoint |
| `docs/AI_BESTIE_FEATURE.md` | Full AI Bestie technical reference |

---

## Questions?

Ping the engineering team. The migration is non-destructive and reversible. No other tables are touched.
