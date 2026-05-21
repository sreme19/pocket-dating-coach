# Supabase Migration Handoff — AI Bestie Feature

**Project:** pocket-dating-coach  
**Supabase URL:** `https://stikoktiaxqtcsohcxzp.supabase.co`  
**Migration file:** `supabase/migrations/20260522_add_ai_bestie_active_to_matches.sql`

---

## What to run

### 1. Add `ai_bestie_active` column to `verified_vibe_matches`

```sql
ALTER TABLE verified_vibe_matches
  ADD COLUMN IF NOT EXISTS ai_bestie_active BOOLEAN NOT NULL DEFAULT FALSE;
```

**That's the only DDL required.** No new tables, no index, no RLS changes.

---

## Why no RLS change is needed

The existing policy already covers this column:

```sql
-- Already in place — allows either user in a match to UPDATE the row
CREATE POLICY "Users can update own matches"
  ON verified_vibe_matches
  FOR UPDATE
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);
```

The activate endpoint (`POST /api/verified-vibe/ai-bestie/activate`) also uses the Supabase service role key server-side, which bypasses RLS entirely, so there's no risk of policy conflicts.

---

## What this enables

When a female user (Neha) activates AI Bestie in a chat:
- The app calls `POST /api/verified-vibe/ai-bestie/activate` with the `conversationId`
- That endpoint flips `ai_bestie_active = true` on the matching row
- When the male user (Adrian) opens the same chat, the GET endpoint returns `aiBestieActive: true`
- Adrian sees an intro card explaining that Neha is using AI Bestie to interview him

---

## Verification query

After running the migration, confirm the column exists:

```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'verified_vibe_matches'
  AND column_name = 'ai_bestie_active';
```

Expected result:

| column_name       | data_type | column_default | is_nullable |
|-------------------|-----------|----------------|-------------|
| ai_bestie_active  | boolean   | false          | NO          |

---

## Rollback (if needed)

```sql
ALTER TABLE verified_vibe_matches
  DROP COLUMN IF EXISTS ai_bestie_active;
```
