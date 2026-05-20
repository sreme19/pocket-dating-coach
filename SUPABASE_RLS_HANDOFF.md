# Supabase RLS Configuration Handoff

**For**: Kiro (Supabase MCP)  
**Project**: pocket-dating-coach  
**Issue**: Discover page failing with "Unauthorized" errors when loading seed profiles

---

## Problem Summary

The Discover page (`/verified-vibe/discover`) successfully loads but fails to fetch profiles from the API with repeated `Unauthorized` errors:

```
Error: Failed to load profiles: Unauthorized
    at loadProfiles (discover/+page.svelte:89:11)
```

**What's working:**
- ✅ Database schema deployed (7 tables created)
- ✅ 43 seed profiles in `verified_vibe_users` table
- ✅ 172 verification steps in `verified_vibe_verification` table
- ✅ 20 seed matches in `verified_vibe_matches` table
- ✅ Seed account authentication works (can login)
- ✅ All frontend code fixed (table names corrected)
- ✅ API endpoint `/api/verified-vibe/discovery-feed` is returning 401 Unauthorized

**What's broken:**
- ❌ API endpoint can't query `verified_vibe_users` table despite RLS supposedly disabled
- ❌ The API is hitting line 76-81 in discovery-feed/+server.ts: session validation passes, but query returns 401

---

## Root Cause

**Supabase RLS Policy Issue** — The API endpoint validates the user session successfully but Supabase RLS policies are blocking the SELECT query on `verified_vibe_users` table.

Key evidence:
- API gets valid session: `const { data: { session } } = await supabase.auth.getSession();` ✅ (session exists)
- Query fails immediately after: `.from('verified_vibe_users').select('*')` ❌ (returns 401)
- Error occurs repeatedly, indicating a policy-level block not a query issue

---

## Code Changes Already Made

**I've already fixed all frontend/API code issues:**

### 1. File: `src/routes/api/verified-vibe/discovery-feed/+server.ts`
- ✅ Changed table: `verified_vibe_profiles` → `verified_vibe_users` (line 87)
- ✅ Changed table: `verified_vibe_verification_steps` → `verified_vibe_verification` (line 101)
- ✅ Changed field: `trust_points` → `status: 'completed'` (line 106)

### 2. File: `src/lib/verified-vibe/services/profileService.ts`
- ✅ Changed all references: `verified_vibe_profiles` → `verified_vibe_users`
- ✅ Changed all references: `verified_vibe_verification_steps` → `verified_vibe_verification`
- ✅ Updated interface: `VVVerificationStep.trust_points` → `VVVerificationStep.status`

### 3. File: `src/routes/api/verified-vibe/verify-step/+server.ts`
- ✅ Changed table: `verified_vibe_verification_steps` → `verified_vibe_verification` (line 73)
- ✅ Updated insert: `trust_points` → `status: 'completed'` (line 75)

---

## What You Need to Fix (Supabase MCP)

### Task: Disable or Fix RLS Policies on Discovery Tables

The API is authenticated but RLS is blocking queries. You need to either:

**Option A: Disable RLS on tables (recommended for development)**
```
Supabase Dashboard → Tables → verified_vibe_users → Security
→ Turn OFF "Row Level Security (RLS)"
```

Then repeat for:
- `verified_vibe_verification`
- `verified_vibe_matches`
- `verified_vibe_likes`
- `verified_vibe_passes`

**Option B: Create RLS Policies (if you want RLS enabled)**
For `verified_vibe_users` table:
```sql
-- Allow authenticated users to view all profiles (except their own)
CREATE POLICY "Users can view other profiles"
  ON verified_vibe_users
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON verified_vibe_users
  FOR UPDATE
  USING (id = auth.uid());
```

Then create similar policies for other tables:
- `verified_vibe_verification`: Allow users to view their own verification steps
- `verified_vibe_matches`: Allow users to view matches they're part of
- `verified_vibe_likes` / `verified_vibe_passes`: Allow users to view/create their own

---

## Testing After Fix

Once RLS is configured, the Discover page should:
1. Load the seed profiles successfully
2. Show profile cards with archetype, age, city, trust score
3. Allow swiping (like/pass) on profiles
4. Display existing matches

**Test endpoints:**
```bash
# Direct database query (should work after)
curl https://stikoktiaxqtcsohcxzp.supabase.co/rest/v1/verified_vibe_users \
  -H "Authorization: Bearer <user-token>" \
  -H "apikey: <anon-key>"

# API endpoint
curl http://localhost:5174/api/verified-vibe/discovery-feed \
  -H "Authorization: Bearer <user-token>"
```

---

## Supabase Project Details

- **URL**: https://stikoktiaxqtcsohcxzp.supabase.co
- **Service Role Key**: Available in `.env.local` → `SUPABASE_SERVICE_KEY`
- **Anon Key**: Available in `.env.local` → `PUBLIC_SUPABASE_ANON_KEY`
- **Tables affected**:
  - `verified_vibe_users` (43 profiles)
  - `verified_vibe_verification` (172 records)
  - `verified_vibe_matches` (20 records)
  - `verified_vibe_likes` / `verified_vibe_passes`

---

## Quick Verification

Before starting, verify the tables exist and have data:

```sql
SELECT count(*) FROM verified_vibe_users;  -- Should be 43
SELECT count(*) FROM verified_vibe_verification;  -- Should be 172
SELECT count(*) FROM verified_vibe_matches;  -- Should be 20
```

---

## Contact & Next Steps

1. **Apply RLS fix** using Supabase MCP
2. **Test the Discover page** — profiles should load
3. **Verify all CRUD operations** — like/pass/match flows
4. **Report back** once fixed

Once RLS is sorted, the entire seed profile system will be 100% functional!
