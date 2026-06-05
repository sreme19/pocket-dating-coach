# Preferences Implementation — AI Bestie Feature

**Status:** Ready for database migration and seeding  
**Last Updated:** 2026-05-22

---

## Overview

This document captures the full implementation of grounding AI Bestie responses in a user's dating preferences. The feature allows the system to personalize coaching cards by injecting the female user's preferences, values, and lifestyle context into Claude's analysis prompt.

---

## Architecture

### Data Model

**Table:** `verified_vibe_users`  
**New Column:** `preferences JSONB DEFAULT '{}'::jsonb`  
**Index:** `GIN` index on `preferences` for fast lookups

**Structure:**
```json
{
  "lookingFor": ["serious relationship"],
  "nonNegotiables": ["understands the NRI experience from the inside"],
  "strongPreferences": ["based in UK or Europe", "career-stable"],
  "openTo": ["Indian men based in India if relocation negotiable"],
  "notLookingFor": ["ABCD types who abandoned Indian culture"],
  "communicationStyle": ["warm and articulate", "addresses cultural tension directly"],
  "greenFlags": ["navigated family expectations honestly", "has friends across cultural lines"],
  "yellowFlags": ["'I'm very open-minded about culture'"],
  "redFlags": ["expects her to become more traditionally Indian"],
  "interviewNotes": "Ask where he wants to live in five years and whether he asks her the same."
}
```

### Request Flow

```
Neha (female) activates AI Bestie
  ↓
Adrian (male) sends message
  ↓
Poller detects new message
  ↓
Call: POST /api/verified-vibe/ai-bestie/generate-response
  Payload: {
    conversationId,
    adrianMessage,
    matchName: "Adrian",
    userId: "neha-uuid"  ← NEW
  }
  ↓
Server fetches Neha's profile:
  - preferences JSONB
  - about (text)
  - looking (text)
  ↓
Build context string:
  ```
  About her: [about text]
  Looking for: [looking text]
  Her preferences: [JSON stringified]
  ```
  ↓
Inject into Claude prompt:
  ```
  You are AI Bestie — a sharp, no-nonsense dating coach helping a woman 
  interview and evaluate a male match named Adrian.
  
  About her: ...
  Looking for: ...
  Her preferences: {...}
  
  Adrian just said: "[message]"
  
  Evaluate his response and produce exactly three fields...
  ```
  ↓
Claude returns: { signal, read, suggestedQuestion }
  ↓
Display coaching card to Neha + send question to Adrian
```

---

## Implementation Checklist

### ✅ Backend Implementation

1. **Database Schema**
   - File: `supabase/migrations/20260522_add_preferences_to_users.sql`
   - Adds `preferences JSONB DEFAULT '{}'::jsonb`
   - Creates GIN index
   - Handoff: `supabase/migrations/KIRO_PREFERENCES_MIGRATION.md`
   - **Status:** Ready to apply via Kiro

2. **TypeScript Types**
   - File: `src/lib/server/supabase.ts`
   - Updated `Database` type to include `preferences` in Row and Insert
   - **Status:** ✅ Complete

3. **API Endpoint**
   - File: `src/routes/api/verified-vibe/ai-bestie/generate-response/+server.ts`
   - Accepts `userId` in request payload
   - Fetches user preferences from Supabase
   - Builds preferences context string
   - Injects into Claude prompt
   - **Status:** ✅ Complete

### ✅ Frontend Implementation

1. **Chat Page**
   - File: `src/routes/verified-vibe/chat/[conversationId]/+page.svelte`
   - Updated `generateAndSendAIBestieResponse()` to send `userId: $user?.id`
   - **Status:** ✅ Complete

### ⏳ Database & Seeding

1. **Migration**
   - File: `supabase/migrations/20260522_add_preferences_to_users.sql`
   - **Next Step:** Apply via Kiro dashboard using `KIRO_PREFERENCES_MIGRATION.md`

2. **Seed Preferences**
   - File: `scripts/seed-preferences.ts`
   - Parses all `preferences.md` files from `/static/female_profiles/`
   - Structures as JSON and updates `verified_vibe_users.preferences`
   - **Next Step:** Run after migration:
     ```bash
     npm run seed:preferences
     ```
   - Add to `package.json`:
     ```json
     "seed:preferences": "tsx scripts/seed-preferences.ts"
     ```

---

## Next Steps (for Kiro / DevOps)

### Step 1: Apply Migration (Kiro Dashboard)

1. Navigate to Kiro → Migrations
2. Paste SQL from `KIRO_PREFERENCES_MIGRATION.md`
3. Execute
4. Verify using the verification query provided

### Step 2: Run Seed Script (Local Machine)

```bash
# Ensure env vars are set
export PUBLIC_SUPABASE_URL="https://stikoktiaxqtcsohcxzp.supabase.co"
export SUPABASE_SERVICE_KEY="[your service key]"

# Run seed script
npm run seed:preferences
```

**Expected output:**
```
✓ Updated preferences for neha_NRI_Diaspora_x5r2vd
✓ Updated preferences for priya_High_Value_Feminist_f2k7zt
... (20+ profiles)

📊 Summary:
  ✓ Updated: 20
  ⚠ Skipped: 0
  ✗ Errors: 0
```

### Step 3: Test End-to-End

**Setup:**
- Tab 1: Incognito, logged in as Neha (`neha@seed.vv`)
- Tab 2: Incognito, logged in as Adrian (`adrian@seed.vv`)

**Flow:**
1. Tab 1: Open chat with Adrian
2. Tab 1: Activate AI Bestie
3. Tab 2: Reload — should see intro card
4. Tab 2: Send a message
5. Tab 1: Within 5 seconds, should see coaching card with signal/read
6. Verify the read references Neha's preferences (e.g., mentions NRI context, career ambition, etc.)

---

## Files Summary

| File | Status | Purpose |
|------|--------|---------|
| `supabase/migrations/20260522_add_preferences_to_users.sql` | Ready | DDL: add preferences column + GIN index |
| `supabase/migrations/KIRO_PREFERENCES_MIGRATION.md` | Ready | Handoff doc for Kiro |
| `src/lib/server/supabase.ts` | ✅ Done | TypeScript types |
| `src/routes/api/verified-vibe/ai-bestie/generate-response/+server.ts` | ✅ Done | Fetches preferences, injects into prompt |
| `src/routes/verified-vibe/chat/[conversationId]/+page.svelte` | ✅ Done | Passes `userId` to endpoint |
| `scripts/seed-preferences.ts` | ✅ Done | Parses `.md` files, seeds database |

---

## Integration with Existing Flow

### For New Users (Onboarding)

When a new female user completes onboarding, the app should:
1. Collect preferences (or derive from onboarding form answers)
2. Structure as JSON
3. Call: `UPDATE verified_vibe_users SET preferences = $1 WHERE id = $2`

**Endpoint to create:** `POST /api/verified-vibe/preferences/update`

### For Active Chat Updates

When Neha provides self-insights during chat (e.g., "I'm looking for someone ambitious"):
1. Parse the insight
2. Merge into existing preferences object
3. Persist to database

**Endpoint to create:** `POST /api/verified-vibe/preferences/merge`

---

## Testing

### Unit Tests

None yet — this is integration-level functionality. Consider adding:
- Test that endpoint rejects requests without `userId`
- Test that preferences context is properly formatted
- Test that Claude receives correct context in prompt

### Integration Tests

Run the E2E flow above (Step 3) before shipping.

---

## Notes

- **Preferences are human-readable:** The JSON structure is designed to be parsed by humans (e.g., in debugging or admin dashboards) as well as Claude.
- **No RLS changes needed:** The `preferences` column is part of the user's profile, which existing RLS policies already protect.
- **Flexible schema:** New keys can be added to preferences without schema changes (thanks to JSONB).
- **Indexing:** GIN index enables fast queries if preferences are later used for filtering/matching (future work).

---

## Rollback

If preferences need to be rolled back:

```bash
# Via Kiro:
DROP INDEX IF EXISTS idx_verified_vibe_users_preferences;
ALTER TABLE verified_vibe_users DROP COLUMN IF EXISTS preferences;
```

The endpoint will gracefully handle missing preferences (defaults to `preferences_context = ''`).
