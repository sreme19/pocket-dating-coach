# Supabase RLS Policy Configuration Handoff

**For**: Kiro (Supabase MCP)  
**Project**: pocket-dating-coach  
**Task**: Enable Row Level Security (RLS) with proper policies for verified-vibe tables  
**Status**: Ready for implementation

---

## Current Problem

The Discover page and authentication routing fail with "Unauthorized" errors because:
- RLS is enabled on tables but **policies are missing**
- Users can't access their own profile data after login
- Seed accounts get sent to onboarding instead of discover/verify pages

**Root Cause**: When `getProfile()` queries `verified_vibe_users`, RLS blocks the SELECT because no policy allows authenticated users to access data.

---

## Solution: RLS Policies

Enable RLS with proper policies on 5 core tables so users can:
- View their own profile
- Access their own verification steps
- View matches they're part of
- Create/view their own likes and passes

---

## RLS Policy SQL Commands

Run these commands in Supabase Dashboard → SQL Editor:

### 1. Enable RLS on verified_vibe_users

```sql
-- Enable RLS
ALTER TABLE verified_vibe_users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON verified_vibe_users
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON verified_vibe_users
  FOR UPDATE
  USING (auth.uid() = id);

-- Policy: Users can insert their own profile (for new signups)
CREATE POLICY "Users can insert own profile"
  ON verified_vibe_users
  FOR INSERT
  WITH CHECK (auth.uid() = id);
```

### 2. Enable RLS on verified_vibe_verification

```sql
-- Enable RLS
ALTER TABLE verified_vibe_verification ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own verification steps
CREATE POLICY "Users can view own verification"
  ON verified_vibe_verification
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can update their own verification
CREATE POLICY "Users can update own verification"
  ON verified_vibe_verification
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own verification
CREATE POLICY "Users can insert own verification"
  ON verified_vibe_verification
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### 3. Enable RLS on verified_vibe_matches

```sql
-- Enable RLS
ALTER TABLE verified_vibe_matches ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view matches they're part of
CREATE POLICY "Users can view own matches"
  ON verified_vibe_matches
  FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Policy: Users can update matches they're part of
CREATE POLICY "Users can update own matches"
  ON verified_vibe_matches
  FOR UPDATE
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Policy: Users can insert matches (when swiping)
CREATE POLICY "Users can create matches"
  ON verified_vibe_matches
  FOR INSERT
  WITH CHECK (auth.uid() = user1_id);
```

### 4. Enable RLS on verified_vibe_likes

```sql
-- Enable RLS
ALTER TABLE verified_vibe_likes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own likes
CREATE POLICY "Users can view own likes"
  ON verified_vibe_likes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can create likes
CREATE POLICY "Users can create likes"
  ON verified_vibe_likes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own likes
CREATE POLICY "Users can delete own likes"
  ON verified_vibe_likes
  FOR DELETE
  USING (auth.uid() = user_id);
```

### 5. Enable RLS on verified_vibe_passes

```sql
-- Enable RLS
ALTER TABLE verified_vibe_passes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own passes
CREATE POLICY "Users can view own passes"
  ON verified_vibe_passes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can create passes
CREATE POLICY "Users can create passes"
  ON verified_vibe_passes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own passes
CREATE POLICY "Users can delete own passes"
  ON verified_vibe_passes
  FOR DELETE
  USING (auth.uid() = user_id);
```

### 6. Enable RLS on verified_vibe_messages (Optional - for messaging feature)

```sql
-- Enable RLS
ALTER TABLE verified_vibe_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view messages they're part of
CREATE POLICY "Users can view own messages"
  ON verified_vibe_messages
  FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Policy: Users can send messages
CREATE POLICY "Users can send messages"
  ON verified_vibe_messages
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id);
```

---

## Policy Explanation

Each policy follows the pattern: **Users can only access their own data**

| Table | SELECT | UPDATE | INSERT |
|-------|--------|--------|--------|
| `verified_vibe_users` | Own profile only | Own profile | Own profile (signup) |
| `verified_vibe_verification` | Own verification records | Own records | Own records |
| `verified_vibe_matches` | Matches they're part of (user1 or user2) | Matches they're part of | Only as user1 (creator) |
| `verified_vibe_likes` | Own likes | N/A | Own likes | Own likes |
| `verified_vibe_passes` | Own passes | N/A | Own passes | Own passes |
| `verified_vibe_messages` | Messages involving them | N/A | Messages they send | N/A |

### How Policies Work

**SELECT**: `auth.uid() = id` means "only return rows where the authenticated user's ID matches the row's user ID"

**UPDATE/DELETE**: `auth.uid() = user_id` means "users can only modify their own data"

**INSERT**: `WITH CHECK (auth.uid() = user_id)` means "users can only insert rows for themselves"

---

## Testing After Implementation

Once policies are in place, test with curl:

### Test 1: Get valid session token
```bash
# Login with seed account to get OTP
curl -X POST http://localhost:5174/api/verified-vibe/seed-login \
  -H "Content-Type: application/json" \
  -d '{"email": "adrian_ambitious_young_tech_j9k4bz@seed.vv", "password": "SeedPass123!"}'

# Response: {"otp": "123456"}

# Then verify OTP to get session token (done in browser)
```

### Test 2: Query with user token
```bash
# Use the session access_token to query profile
curl https://stikoktiaxqtcsohcxzp.supabase.co/rest/v1/verified_vibe_users \
  -H "Authorization: Bearer <user-access-token>" \
  -H "apikey: <anon-key>"

# Should return: User's own profile data (not 401 Unauthorized)
```

### Test 3: Verify discovery feed works
```bash
# Test the discovery feed endpoint with user token
curl http://localhost:5174/api/verified-vibe/discovery-feed \
  -H "Authorization: Bearer <user-access-token>"

# Should return: List of profiles (not 401 errors)
```

---

## Expected Results After RLS Configuration

| Scenario | Before | After |
|----------|--------|-------|
| Seed account login | ✅ Login works | ✅ Login works |
| Profile query after login | ❌ 401 Unauthorized | ✅ Returns own profile |
| Routing to discover | ❌ Sent to gate | ✅ Sent to discover (if profile complete) |
| Discovery feed load | ❌ 401 Unauthorized | ✅ Loads all profiles |
| Like/pass swipes | ❌ 401 Unauthorized | ✅ Can like/pass profiles |

---

## Supabase Project Details

- **URL**: https://stikoktiaxqtcsohcxzp.supabase.co
- **Tables affected**: 
  - `verified_vibe_users` (43 seed profiles)
  - `verified_vibe_verification` (172 seed verification records)
  - `verified_vibe_matches` (20 seed matches)
  - `verified_vibe_likes` (seed likes data)
  - `verified_vibe_passes` (seed passes data)
  - `verified_vibe_messages` (messaging feature)

---

## Important Notes

### ⚠️ Order of Execution
1. Run commands in the order listed (1-6)
2. Each table needs RLS enabled FIRST, then policies added
3. Do NOT skip any table

### ⚠️ Validation
After creating each policy, verify in Supabase Dashboard:
- Go to Tables → [table name] → Security
- Confirm RLS is ON
- Confirm all policies appear in the list

### ✅ Backwards Compatibility
- These policies only affect SELECT/UPDATE/INSERT operations on specific columns
- Seed account service-role operations continue to work
- No breaking changes to existing API endpoints

### 🔐 Security
- Policies enforce user isolation (users can only access their own data)
- Admin/service-role operations bypass RLS (for backend operations)
- Matches require being one of the two users involved

---

## Rollback Plan

If policies need to be removed (e.g., to revert to no RLS):

```sql
-- Disable RLS on all tables
ALTER TABLE verified_vibe_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE verified_vibe_verification DISABLE ROW LEVEL SECURITY;
ALTER TABLE verified_vibe_matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE verified_vibe_likes DISABLE ROW LEVEL SECURITY;
ALTER TABLE verified_vibe_passes DISABLE ROW LEVEL SECURITY;
ALTER TABLE verified_vibe_messages DISABLE ROW LEVEL SECURITY;
```

---

## Contact & Next Steps

1. **Implement RLS policies** using commands above (6 tables total)
2. **Verify in Supabase Dashboard** that all policies show as "Active"
3. **Test with curl** commands provided above
4. **Report back** once policies are active and tested

Once RLS policies are configured, the entire verified-vibe feature will be 100% functional with proper data isolation! ✅

