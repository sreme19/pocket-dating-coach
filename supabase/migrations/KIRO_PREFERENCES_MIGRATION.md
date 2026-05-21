# Supabase Migration Handoff — Preferences Field for AI Bestie

**Project:** pocket-dating-coach  
**Supabase URL:** `https://stikoktiaxqtcsohcxzp.supabase.co`  
**Migration file:** `supabase/migrations/20260522_add_preferences_to_users.sql`

---

## What to run

### 1. Add `preferences` JSONB column to `verified_vibe_users`

```sql
ALTER TABLE verified_vibe_users
  ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;
```

### 2. Create a GIN index for fast lookups

```sql
CREATE INDEX IF NOT EXISTS idx_verified_vibe_users_preferences ON verified_vibe_users USING GIN (preferences);
```

**That's all the DDL required.** No RLS changes needed — existing policies cover this column.

---

## Why no RLS change is needed

The existing policy already allows updates to user profiles:

```sql
-- Already in place — allows users to update their own profile
CREATE POLICY "Users can update own profile"
  ON verified_vibe_users
  FOR UPDATE
  USING (auth.uid() = id);
```

The API endpoint (`POST /api/verified-vibe/ai-bestie/generate-response`) uses the Supabase service role key server-side to fetch preferences, which bypasses RLS entirely.

---

## What this enables

When a female user (Neha) activates AI Bestie:
- The app calls `POST /api/verified-vibe/ai-bestie/generate-response` with Adrian's message and **her `userId`**
- That endpoint fetches her `about`, `looking`, and `preferences` from the database
- These fields are injected into the Claude prompt as personalized context
- Claude's analysis becomes grounded in Neha's actual dating criteria, values, and lifestyle preferences

Example preferences shape:
```json
{
  "lookingFor": "serious relationship",
  "values": ["honesty", "ambition", "shared interests"],
  "dealBreakers": ["smoking", "financial instability"],
  "ageRange": "28-35",
  "lifestyle": "urban, weekend traveler"
}
```

---

## Verification query

After running the migration, confirm both additions:

```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'verified_vibe_users'
  AND column_name = 'preferences';

SELECT indexname FROM pg_indexes 
WHERE tablename = 'verified_vibe_users' 
  AND indexname = 'idx_verified_vibe_users_preferences';
```

Expected results:

**Column:**
| column_name | data_type | column_default | is_nullable |
|-------------|-----------|----------------|-------------|
| preferences | jsonb     | '{}'::jsonb    | YES         |

**Index:**
| indexname                                 |
|-------------------------------------------|
| idx_verified_vibe_users_preferences       |

---

## Rollback (if needed)

```sql
DROP INDEX IF EXISTS idx_verified_vibe_users_preferences;

ALTER TABLE verified_vibe_users
  DROP COLUMN IF EXISTS preferences;
```
