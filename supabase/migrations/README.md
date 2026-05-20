# Supabase Migrations

## Before running seed-profiles

The seed script requires these tables to exist in Supabase. If you haven't deployed them yet:

1. **Go to Supabase Dashboard**:
   - Navigate to your project: https://supabase.com/dashboard/project/[project-id]
   - Go to **SQL Editor** → **New Query**

2. **Copy and run the migration**:
   - Open `20260520_create_verified_vibe_tables.sql`
   - Copy the entire SQL
   - Paste into the Supabase SQL editor
   - Click **Run**

3. **Once deployed**, the following tables will exist:
   - `verified_vibe_users` — Core user profiles
   - `verified_vibe_verification` — Verification step tracking
   - `verified_vibe_likes` — User likes
   - `verified_vibe_passes` — User passes
   - `verified_vibe_matches` — Mutual matches
   - `verified_vibe_messages` — Chat messages
   - `verified_vibe_typing_indicators` — Real-time typing status

4. **Then run the seeding script**:
   ```bash
   npm run seed:profiles
   ```

## Schema Notes

- All tables use UUID primary keys
- Foreign key constraints ensure referential integrity
- Indexes are created for common query patterns
- Realtime is enabled for messages and typing indicators
- `status` field in verification table defaults to 'pending'

## Rollback

If you need to delete seed data (keep the tables):

```sql
DELETE FROM verified_vibe_messages;
DELETE FROM verified_vibe_typing_indicators;
DELETE FROM verified_vibe_matches;
DELETE FROM verified_vibe_passes;
DELETE FROM verified_vibe_likes;
DELETE FROM verified_vibe_verification;
DELETE FROM verified_vibe_users WHERE trust_score < 100; -- Only deletes seed users
```
