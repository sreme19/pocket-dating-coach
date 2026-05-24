# Deployment Checklist — Preferences Migration

**Project:** pocket-dating-coach  
**Feature:** AI Bestie Preferences  
**Status:** Ready for deployment  
**Date:** May 22, 2026

---

## Pre-Deployment

- [ ] All code changes committed to main branch
- [ ] `.env.local` has `PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
- [ ] Supabase project is accessible
- [ ] Database backups are current

---

## Step 1: Apply Migration

### Option A: Via Supabase Dashboard

1. [ ] Go to Supabase Dashboard → SQL Editor
2. [ ] Create new query
3. [ ] Paste SQL from `supabase/migrations/20260522_add_preferences_to_users.sql`:
   ```sql
   ALTER TABLE verified_vibe_users
     ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

   CREATE INDEX IF NOT EXISTS idx_verified_vibe_users_preferences ON verified_vibe_users USING GIN (preferences);
   ```
4. [ ] Click "Run"
5. [ ] Confirm success message

### Option B: Via Kiro

1. [ ] Open Kiro dashboard
2. [ ] Navigate to Migrations
3. [ ] Select `supabase/migrations/20260522_add_preferences_to_users.sql`
4. [ ] Execute
5. [ ] Confirm success

---

## Step 2: Verify Migration

Run verification query in Supabase SQL Editor:

```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'verified_vibe_users'
  AND column_name = 'preferences';

SELECT indexname FROM pg_indexes 
WHERE tablename = 'verified_vibe_users' 
  AND indexname = 'idx_verified_vibe_users_preferences';
```

- [ ] Column query returns: `preferences | jsonb | '{}'::jsonb | YES`
- [ ] Index query returns: `idx_verified_vibe_users_preferences`

### Alternative: Run Verification Script

```bash
npm run verify:preferences
```

- [ ] Script completes with ✅ status

---

## Step 3: Seed Preferences (Optional but Recommended)

If you have female profile folders with `preferences.md` files:

```bash
npm run seed:preferences
```

- [ ] Script completes without errors
- [ ] Output shows updated profiles
- [ ] No errors in console

**Expected output:**
```
✓ Updated preferences for [profile_name]
✓ Updated preferences for [profile_name]
...

📊 Summary:
  ✓ Updated: [count]
  ⚠ Skipped: [count]
  ✗ Errors: 0
```

---

## Step 4: Test End-to-End

### Setup

- [ ] Open two incognito browser windows
- [ ] Tab 1: Log in as female user (e.g., `neha@seed.vv`)
- [ ] Tab 2: Log in as male user (e.g., `adrian@seed.vv`)
- [ ] Both users have an active match

### Test Flow

1. [ ] Tab 1: Open chat with male user
2. [ ] Tab 1: Click "Activate AI Bestie" button
3. [ ] Tab 2: Reload page (should see intro card)
4. [ ] Tab 2: Send a message to female user
5. [ ] Tab 1: Within 5 seconds, coaching card appears
6. [ ] Verify coaching card contains:
   - [ ] Signal emoji (✅, ⚠️, or 🚩)
   - [ ] Read (analysis text)
   - [ ] Suggested question visible
7. [ ] Tab 2: Verify suggested question was received
8. [ ] Verify read text references female user's preferences (e.g., mentions her values, lifestyle, etc.)

---

## Step 5: Deploy to Production

- [ ] All tests pass
- [ ] No errors in browser console
- [ ] No errors in server logs
- [ ] Commit any final changes
- [ ] Push to main branch
- [ ] Deploy via Vercel (automatic on push to main)

---

## Post-Deployment

- [ ] Monitor error logs for 24 hours
- [ ] Test with real users
- [ ] Verify preferences are being fetched correctly
- [ ] Check Claude responses are personalized
- [ ] Monitor database performance (GIN index)

---

## Rollback Plan

If issues occur, rollback is simple:

```sql
DROP INDEX IF EXISTS idx_verified_vibe_users_preferences;
ALTER TABLE verified_vibe_users DROP COLUMN IF EXISTS preferences;
```

- [ ] Rollback SQL ready
- [ ] Team notified of rollback procedure
- [ ] Backups verified

---

## Troubleshooting

### Migration fails with "column already exists"

This is fine — the `IF NOT EXISTS` clause handles it. The migration is idempotent.

### Seed script fails with "profile not found"

Ensure:
- [ ] Female profile folders exist in `static/female_profiles/`
- [ ] Each folder has `profile.json` with an `id` field
- [ ] Each folder has `preferences.md` file

### API endpoint returns empty preferences

This is expected for users without seeded preferences. The endpoint gracefully handles empty preferences.

### Coaching card doesn't appear

Check:
- [ ] Browser console for errors
- [ ] Server logs for API errors
- [ ] Verify `userId` is being sent to API
- [ ] Verify preferences column exists in database

---

## Sign-Off

- [ ] Deployment lead: _________________ Date: _______
- [ ] QA lead: _________________ Date: _______
- [ ] Product lead: _________________ Date: _______

---

## Notes

- Migration is **non-breaking** — existing code works without preferences
- **No RLS changes needed** — existing policies cover preferences column
- **Preferences are optional** — users without preferences still get coaching (just less personalized)
- **Seed script is optional** — can be run anytime to populate preferences

---

## Support

- Full docs: `PREFERENCES_IMPLEMENTATION.md`
- Quick reference: `QUICK_REFERENCE.md`
- Migration ready: `MIGRATION_READY.md`
- Handoff doc: `supabase/migrations/KIRO_PREFERENCES_MIGRATION.md`
