# Quick Reference — Preferences Migration

## TL;DR

Everything is ready. Run this SQL to deploy:

```sql
ALTER TABLE verified_vibe_users
  ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_verified_vibe_users_preferences ON verified_vibe_users USING GIN (preferences);
```

Then verify:

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'verified_vibe_users' AND column_name = 'preferences';

SELECT indexname FROM pg_indexes 
WHERE tablename = 'verified_vibe_users' AND indexname = 'idx_verified_vibe_users_preferences';
```

Then seed (optional):

```bash
npm run seed:preferences
```

---

## What This Enables

When a female user (Neha) activates AI Bestie:
- Her `preferences` JSONB is fetched from the database
- Combined with her `about` and `looking` fields
- Injected into Claude's prompt for personalized coaching
- Claude's analysis becomes grounded in her actual dating criteria

---

## Files

| File | What |
|------|------|
| `supabase/migrations/20260522_add_preferences_to_users.sql` | The migration SQL |
| `src/lib/server/supabase.ts` | Types (already updated) |
| `src/routes/api/verified-vibe/ai-bestie/generate-response/+server.ts` | API endpoint (already updated) |
| `src/routes/verified-vibe/chat/[conversationId]/+page.svelte` | Frontend (already updated) |
| `scripts/seed-preferences.ts` | Seed script (ready to run) |
| `PREFERENCES_IMPLEMENTATION.md` | Full docs |
| `MIGRATION_READY.md` | Deployment guide |

---

## Status

✅ Backend: Complete  
✅ Frontend: Complete  
✅ Types: Complete  
✅ Seed script: Complete  
⏳ Database: Ready to apply

---

## Rollback

```sql
DROP INDEX IF EXISTS idx_verified_vibe_users_preferences;
ALTER TABLE verified_vibe_users DROP COLUMN IF EXISTS preferences;
```

---

## Support

- Full docs: `PREFERENCES_IMPLEMENTATION.md`
- Deployment guide: `MIGRATION_READY.md`
- Migration handoff: `supabase/migrations/KIRO_PREFERENCES_MIGRATION.md`
