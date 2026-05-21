# ✅ Preferences Migration — Ready for Deployment

**Status:** All components implemented and ready  
**Date:** May 22, 2026  
**Project:** pocket-dating-coach

---

## Executive Summary

The AI Bestie preferences feature is **fully implemented and ready to deploy**. All backend, frontend, and database components are in place. The migration requires two simple SQL commands to add the `preferences` JSONB column and GIN index to the `verified_vibe_users` table.

---

## What's Been Completed

### ✅ Database Schema
- **File:** `supabase/migrations/20260522_add_preferences_to_users.sql`
- **Status:** Ready to apply
- **Contains:**
  - `ALTER TABLE verified_vibe_users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;`
  - `CREATE INDEX IF NOT EXISTS idx_verified_vibe_users_preferences ON verified_vibe_users USING GIN (preferences);`

### ✅ TypeScript Types
- **File:** `src/lib/server/supabase.ts`
- **Status:** Complete
- **Includes:** `preferences: Record<string, unknown> | null` in Row and Insert types

### ✅ API Endpoint
- **File:** `src/routes/api/verified-vibe/ai-bestie/generate-response/+server.ts`
- **Status:** Complete
- **Functionality:**
  - Accepts `userId` in request payload
  - Fetches user's `preferences`, `about`, and `looking` from database
  - Builds context string with all three fields
  - Injects into Claude prompt for personalized analysis
  - Returns signal, read, and suggestedQuestion

### ✅ Frontend Integration
- **File:** `src/routes/verified-vibe/chat/[conversationId]/+page.svelte`
- **Status:** Complete
- **Functionality:**
  - `generateAndSendAIBestieResponse()` sends `userId: $user?.id` to API
  - Properly passes all required fields: conversationId, adrianMessage, matchName, userId

### ✅ Seed Script
- **File:** `scripts/seed-preferences.ts`
- **Status:** Complete
- **Functionality:**
  - Parses `preferences.md` files from female profile folders
  - Structures as JSON with keys: lookingFor, nonNegotiables, strongPreferences, openTo, notLookingFor, communicationStyle, greenFlags, yellowFlags, redFlags, interviewNotes
  - Updates `verified_vibe_users.preferences` for each profile
  - Registered in package.json as `npm run seed:preferences`

---

## Deployment Steps

### Step 1: Apply Database Migration

Run the SQL from `supabase/migrations/20260522_add_preferences_to_users.sql`:

```sql
ALTER TABLE verified_vibe_users
  ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_verified_vibe_users_preferences ON verified_vibe_users USING GIN (preferences);
```

**Via Supabase Dashboard:**
1. Go to SQL Editor
2. Paste the above SQL
3. Click "Run"

**Via Kiro:**
- Use the migration file at `supabase/migrations/20260522_add_preferences_to_users.sql`

### Step 2: Verify Migration

Run the verification query:

```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'verified_vibe_users'
  AND column_name = 'preferences';

SELECT indexname FROM pg_indexes 
WHERE tablename = 'verified_vibe_users' 
  AND indexname = 'idx_verified_vibe_users_preferences';
```

**Expected Results:**

Column:
| column_name | data_type | column_default | is_nullable |
|-------------|-----------|----------------|-------------|
| preferences | jsonb     | '{}'::jsonb    | YES         |

Index:
| indexname                                 |
|-------------------------------------------|
| idx_verified_vibe_users_preferences       |

### Step 3: Seed Preferences (Optional but Recommended)

After migration, populate preferences for existing female profiles:

```bash
npm run seed:preferences
```

**Requirements:**
- `.env.local` must have `PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
- Female profile folders must have `preferences.md` files

**Expected Output:**
```
✓ Updated preferences for neha_NRI_Diaspora_x5r2vd
✓ Updated preferences for priya_High_Value_Feminist_f2k7zt
... (more profiles)

📊 Summary:
  ✓ Updated: 20
  ⚠ Skipped: 0
  ✗ Errors: 0
```

---

## How It Works

### User Flow

1. **Neha (female) activates AI Bestie** in chat with Adrian
2. **Adrian sends a message**
3. **Poller detects new message** and calls `POST /api/verified-vibe/ai-bestie/generate-response`
4. **Payload includes:**
   ```json
   {
     "conversationId": "...",
     "adrianMessage": "...",
     "matchName": "Adrian",
     "userId": "neha-uuid"
   }
   ```
5. **Server fetches Neha's profile:**
   - `preferences` (JSONB)
   - `about` (text)
   - `looking` (text)
6. **Builds context string:**
   ```
   About her: [about text]
   Looking for: [looking text]
   Her preferences: [JSON stringified]
   ```
7. **Injects into Claude prompt** for personalized analysis
8. **Claude returns:** signal (✅/⚠️/🚩), read (analysis), suggestedQuestion
9. **Coaching card displayed to Neha** (not sent to Adrian)
10. **Suggested question auto-sent to Adrian**

### Example Preferences Structure

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

---

## RLS & Security

**No RLS changes needed.** The existing policy already covers this:

```sql
CREATE POLICY "Users can update own profile"
  ON verified_vibe_users
  FOR UPDATE
  USING (auth.uid() = id);
```

The API endpoint uses the Supabase service role key server-side, which bypasses RLS entirely. Preferences are fetched securely and never exposed to the male user.

---

## Rollback (if needed)

If preferences need to be removed:

```sql
DROP INDEX IF EXISTS idx_verified_vibe_users_preferences;

ALTER TABLE verified_vibe_users
  DROP COLUMN IF EXISTS preferences;
```

The endpoint will gracefully handle missing preferences (defaults to empty context).

---

## Testing Checklist

- [ ] Migration applied successfully
- [ ] Verification query returns expected results
- [ ] Seed script runs without errors (if seeding)
- [ ] Female user can activate AI Bestie
- [ ] Male user sends message
- [ ] Coaching card appears with signal/read
- [ ] Suggested question is sent to male user
- [ ] Coaching card references user's preferences (e.g., mentions NRI context, career ambition, etc.)

---

## Files Reference

| File | Purpose | Status |
|------|---------|--------|
| `supabase/migrations/20260522_add_preferences_to_users.sql` | DDL: add column + index | ✅ Ready |
| `supabase/migrations/KIRO_PREFERENCES_MIGRATION.md` | Handoff doc | ✅ Ready |
| `src/lib/server/supabase.ts` | TypeScript types | ✅ Complete |
| `src/routes/api/verified-vibe/ai-bestie/generate-response/+server.ts` | API endpoint | ✅ Complete |
| `src/routes/verified-vibe/chat/[conversationId]/+page.svelte` | Frontend integration | ✅ Complete |
| `scripts/seed-preferences.ts` | Seed script | ✅ Complete |
| `PREFERENCES_IMPLEMENTATION.md` | Full documentation | ✅ Complete |

---

## Next Steps

1. **Apply migration** using the SQL commands above
2. **Verify** using the verification query
3. **Seed preferences** (optional) using `npm run seed:preferences`
4. **Test end-to-end** using the testing checklist
5. **Deploy** to production

---

## Questions?

Refer to:
- `PREFERENCES_IMPLEMENTATION.md` — Full technical documentation
- `supabase/migrations/KIRO_PREFERENCES_MIGRATION.md` — Migration handoff
- `supabase/migrations/20260522_add_preferences_to_users.sql` — SQL DDL
