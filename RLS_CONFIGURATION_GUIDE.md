# 🔐 RLS Configuration Guide - Pocket Dating Coach

## Overview

This guide walks you through configuring Row Level Security (RLS) policies on the Supabase database to ensure users can only access their own data.

**Status**: Ready to implement  
**Complexity**: Medium (6 tables, straightforward policies)  
**Time Estimate**: 5-10 minutes  

---

## The Problem

Currently, users are experiencing authorization errors:

- ❌ Users get "Unauthorized" errors when accessing profiles
- ❌ Seed accounts are sent to onboarding instead of discover page
- ❌ Discovery feed fails with 401 errors
- ❌ Like/pass functionality blocked by RLS

**Root Cause**: RLS is enabled but policies are missing. Users can't access their own profile data.

---

## The Solution

Enable RLS with 6 sets of policies (one per table) that enforce: **Users can only access their own data**

---

## Implementation Steps

### Step 1: Open Supabase Dashboard

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select the **pocket-dating-coach** project
3. Navigate to **SQL Editor** (left sidebar)

### Step 2: Execute SQL Blocks

Copy and paste each SQL block below into the SQL Editor and click **Run**.

**⚠️ IMPORTANT**: Execute blocks in order (Table 1 → Table 6). Each block must complete before moving to the next.

---

## SQL Blocks to Execute

### TABLE 1: verified_vibe_users

**Purpose**: User profiles with gender, archetype, bio, etc.

```sql
ALTER TABLE verified_vibe_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON verified_vibe_users
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON verified_vibe_users
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON verified_vibe_users
  FOR INSERT
  WITH CHECK (auth.uid() = id);
```

---

### TABLE 2: verified_vibe_verification

**Purpose**: ID verification, liveness, photos, spending/Q&A steps

```sql
ALTER TABLE verified_vibe_verification ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own verification"
  ON verified_vibe_verification
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own verification"
  ON verified_vibe_verification
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own verification"
  ON verified_vibe_verification
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

---

### TABLE 3: verified_vibe_matches

**Purpose**: When two users match (both liked each other)

```sql
ALTER TABLE verified_vibe_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own matches"
  ON verified_vibe_matches
  FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can update own matches"
  ON verified_vibe_matches
  FOR UPDATE
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can create matches"
  ON verified_vibe_matches
  FOR INSERT
  WITH CHECK (auth.uid() = user1_id);
```

---

### TABLE 4: verified_vibe_likes

**Purpose**: User's "like" history when swiping on profiles

```sql
ALTER TABLE verified_vibe_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own likes"
  ON verified_vibe_likes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create likes"
  ON verified_vibe_likes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes"
  ON verified_vibe_likes
  FOR DELETE
  USING (auth.uid() = user_id);
```

---

### TABLE 5: verified_vibe_passes

**Purpose**: User's "pass" history when swiping on profiles

```sql
ALTER TABLE verified_vibe_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own passes"
  ON verified_vibe_passes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create passes"
  ON verified_vibe_passes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own passes"
  ON verified_vibe_passes
  FOR DELETE
  USING (auth.uid() = user_id);
```

---

### TABLE 6: verified_vibe_messages

**Purpose**: Direct messages between matched users

```sql
ALTER TABLE verified_vibe_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages"
  ON verified_vibe_messages
  FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send messages"
  ON verified_vibe_messages
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id);
```

---

## Verification - Test Each Table Works

After implementing all policies, run these tests in Supabase SQL Editor to verify they work:

### Test 1: Authenticated user can see their own profile

```sql
-- This should return the user's profile (not empty)
SELECT * FROM verified_vibe_users WHERE id = auth.uid();
```

**Expected Result**: Returns 1 row (the authenticated user's profile)

---

### Test 2: User CANNOT see other users' profiles

```sql
-- This should return ZERO rows (blocked by RLS)
SELECT * FROM verified_vibe_users WHERE id != auth.uid();
```

**Expected Result**: Returns 0 rows (RLS blocks access to other users' data)

---

### Test 3: Verification data is isolated

```sql
-- Returns only this user's verification steps
SELECT * FROM verified_vibe_verification WHERE user_id = auth.uid();
```

**Expected Result**: Returns only the authenticated user's verification records

---

## Verify RLS is Enabled

1. Go to **Tables** in Supabase Dashboard
2. For each table (verified_vibe_users, verified_vibe_verification, etc.):
   - Click the table name
   - Click the **Security** tab
   - Verify **RLS is enabled** (toggle should be ON)
   - Verify **policies are listed** (should show the policies we created)

---

## What Happens After Policies Are Active

| Feature | Before RLS | After RLS |
|---------|-----------|----------|
| Seed account login | ✅ Works | ✅ Works |
| Profile loads after login | ❌ 401 Error | ✅ Shows own profile |
| Discover page opens | ❌ 401 Error | ✅ Shows all profiles |
| Swiping (like/pass) | ❌ 401 Error | ✅ Can like/pass |
| Matches show | ❌ Unauthorized | ✅ Shows matches |
| Messages (future) | ❌ Unauthorized | ✅ Can message matches |
| Seed accounts routing | ❌ → Gate (onboarding) | ✅ → Discover/Verify |

---

## Policy Logic Explained

### What `auth.uid() = id` means

"The authenticated user's ID must match the row's user ID"

- User A tries to access User B's profile → **Blocked** ❌
- User A tries to access User A's profile → **Allowed** ✅

### What `auth.uid() = user1_id OR auth.uid() = user2_id` means

"User must be either user1 or user2"

- For matches: only the two users involved can see that match
- Other users get "not found"

### What `WITH CHECK` means

Used for INSERT to validate data before inserting

- "Can only insert if user_id is their own ID"
- Prevents inserting likes/messages for other users

---

## Rollback Plan (If needed)

If anything breaks, disable RLS on all tables:

```sql
ALTER TABLE verified_vibe_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE verified_vibe_verification DISABLE ROW LEVEL SECURITY;
ALTER TABLE verified_vibe_matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE verified_vibe_likes DISABLE ROW LEVEL SECURITY;
ALTER TABLE verified_vibe_passes DISABLE ROW LEVEL SECURITY;
ALTER TABLE verified_vibe_messages DISABLE ROW LEVEL SECURITY;
```

---

## Database Details

| Property | Value |
|----------|-------|
| Supabase URL | https://stikoktiaxqtcsohcxzp.supabase.co |
| Project | pocket-dating-coach |
| Tables | 6 (users, verification, matches, likes, passes, messages) |
| Seed Profiles | 43 (all have complete data) |
| Test Accounts | All emails ending in @seed.vv |

---

## Security Model

✅ **User Isolation**: Each user can only access their own data  
✅ **Match Privacy**: Only matched users can see each other  
✅ **Message Privacy**: Only involved users can read messages  
✅ **Admin Bypass**: Service-role operations still work (backend APIs)  
✅ **No Breaking Changes**: Existing endpoints continue to work  

---

## Next Steps

1. ✅ Copy all 6 SQL blocks above
2. ✅ Open Supabase Dashboard → SQL Editor
3. ✅ Execute each block in order (Table 1 → Table 6)
4. ✅ Verify RLS is ON for each table
5. ✅ Run verification tests above
6. ✅ Report back once all tables have active policies

Once RLS is configured, the entire feature will work seamlessly! 🚀

---

## Troubleshooting

### Issue: "Policy already exists" error

**Solution**: The policy might already be created. Check the Security tab for the table and delete existing policies before re-running.

### Issue: "Column does not exist" error

**Solution**: Verify the column names match the table schema. Check the table structure in the Supabase dashboard.

### Issue: Tests return 0 rows

**Solution**: Make sure you're logged in as an authenticated user in the SQL Editor. The `auth.uid()` function only works with authenticated sessions.

---

## Questions?

Refer to the [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security) for more details.
