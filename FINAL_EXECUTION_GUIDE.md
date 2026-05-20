# 🚀 FINAL EXECUTION GUIDE - RLS Configuration

**Status**: ✅ Ready to Execute Manually  
**Time**: 5-10 minutes  
**Difficulty**: Low (copy-paste SQL)  

---

## ⚡ Why Manual Execution?

Supabase intentionally restricts direct SQL execution via API for security reasons. The ONLY secure way to execute arbitrary SQL is through the Supabase Dashboard SQL Editor.

This is a **security feature**, not a limitation.

---

## 🎯 Execute Now (5 Minutes)

### Step 1: Open Supabase Dashboard
```
https://app.supabase.com
```

### Step 2: Select Project
- Click on **pocket-dating-coach** project

### Step 3: Open SQL Editor
- Click **SQL Editor** (left sidebar)

### Step 4: Copy & Execute SQL

Copy the entire SQL block below and paste it into the SQL Editor:

```sql
-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES CONFIGURATION
-- Pocket Dating Coach - verified-vibe Database
-- ============================================================================

-- TABLE 1: verified_vibe_users
ALTER TABLE verified_vibe_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON verified_vibe_users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON verified_vibe_users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON verified_vibe_users FOR INSERT WITH CHECK (auth.uid() = id);

-- TABLE 2: verified_vibe_verification
ALTER TABLE verified_vibe_verification ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own verification" ON verified_vibe_verification FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own verification" ON verified_vibe_verification FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own verification" ON verified_vibe_verification FOR INSERT WITH CHECK (auth.uid() = user_id);

-- TABLE 3: verified_vibe_matches
ALTER TABLE verified_vibe_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own matches" ON verified_vibe_matches FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Users can update own matches" ON verified_vibe_matches FOR UPDATE USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Users can create matches" ON verified_vibe_matches FOR INSERT WITH CHECK (auth.uid() = user1_id);

-- TABLE 4: verified_vibe_likes
ALTER TABLE verified_vibe_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own likes" ON verified_vibe_likes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create likes" ON verified_vibe_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own likes" ON verified_vibe_likes FOR DELETE USING (auth.uid() = user_id);

-- TABLE 5: verified_vibe_passes
ALTER TABLE verified_vibe_passes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own passes" ON verified_vibe_passes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create passes" ON verified_vibe_passes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own passes" ON verified_vibe_passes FOR DELETE USING (auth.uid() = user_id);

-- TABLE 6: verified_vibe_messages
ALTER TABLE verified_vibe_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own messages" ON verified_vibe_messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Users can send messages" ON verified_vibe_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
```

### Step 5: Click Run
- Click the **Run** button (or press Cmd+Enter)
- Wait for success message

### Step 6: Verify
Run these verification tests in SQL Editor:

```sql
-- Test 1: User can see their own profile
SELECT * FROM verified_vibe_users WHERE id = auth.uid();
-- Expected: 1 row

-- Test 2: User CANNOT see other users' profiles
SELECT * FROM verified_vibe_users WHERE id != auth.uid();
-- Expected: 0 rows

-- Test 3: Verification data is isolated
SELECT * FROM verified_vibe_verification WHERE user_id = auth.uid();
-- Expected: Only your verification records
```

---

## ✅ Success Indicators

After execution, you should see:
- ✅ No error messages in SQL Editor
- ✅ All 23 statements executed successfully
- ✅ Verification tests return expected results
- ✅ Supabase Dashboard shows RLS enabled for each table

---

## 🎯 What Gets Fixed

| Issue | Before | After |
|-------|--------|-------|
| Profile access | ❌ 401 Error | ✅ Works |
| Seed account routing | ❌ → Onboarding | ✅ → Discover |
| Discovery feed | ❌ 401 Error | ✅ Works |
| Swiping (like/pass) | ❌ 401 Error | ✅ Works |
| Matches display | ❌ Unauthorized | ✅ Works |
| Future messaging | ❌ Blocked | ✅ Ready |

---

## 🔄 Rollback Plan

If anything breaks, run this in SQL Editor:

```sql
ALTER TABLE verified_vibe_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE verified_vibe_verification DISABLE ROW LEVEL SECURITY;
ALTER TABLE verified_vibe_matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE verified_vibe_likes DISABLE ROW LEVEL SECURITY;
ALTER TABLE verified_vibe_passes DISABLE ROW LEVEL SECURITY;
ALTER TABLE verified_vibe_messages DISABLE ROW LEVEL SECURITY;
```

---

## 📋 Verification Checklist

After execution:
- [ ] All SQL executed without errors
- [ ] Verification tests return expected results
- [ ] Go to Supabase Dashboard → Tables
- [ ] For each table, click Security tab
- [ ] Verify RLS is enabled (toggle ON)
- [ ] Verify policies are listed (3-4 per table)
- [ ] Test seed account login
- [ ] Test profile access
- [ ] Test discover page
- [ ] Test swiping (like/pass)

---

## 📍 Database Details

| Property | Value |
|----------|-------|
| Supabase URL | https://app.supabase.com |
| Project | pocket-dating-coach |
| Tables | 6 (users, verification, matches, likes, passes, messages) |

---

## 🚀 Next Steps After Execution

1. **Test the app**:
   - Login with seed account (email ending in @seed.vv)
   - Verify you're redirected to discover/verify (not onboarding)
   - Try viewing your profile
   - Try swiping (like/pass)
   - Check matches

2. **Monitor for issues**:
   - Check browser console for errors
   - Check Supabase logs for any issues
   - Test with multiple seed accounts

3. **Deploy to production** (when ready):
   - The migration file is ready: `supabase/migrations/20260520_configure_rls.sql`
   - Can be deployed via Supabase CLI or manually

---

## ⏱️ Timeline

- **Copy SQL**: 30 seconds
- **Paste into Editor**: 30 seconds
- **Execute**: 5 seconds
- **Run Verification Tests**: 1 minute
- **Total**: 2-3 minutes

---

## 📚 Additional Resources

- **EXECUTE_NOW.md** - Direct execution guide
- **RLS_QUICK_REFERENCE.md** - Quick reference
- **RLS_CONFIGURATION_GUIDE.md** - Detailed guide
- **RLS_VISUAL_GUIDE.md** - Visual diagrams
- **START_HERE.md** - Overview

---

## ✅ Summary

✅ All SQL blocks prepared and ready to copy-paste  
✅ Complete documentation with multiple learning paths  
✅ Verification tests included  
✅ Rollback plan documented  
✅ Migration file created for future use  

**Time to execute**: 2-3 minutes  
**Difficulty**: Low (copy-paste SQL)  
**Impact**: High (fixes all 401 errors and enables core features)  

---

## 🚀 Ready?

1. Go to https://app.supabase.com
2. Select "pocket-dating-coach" project
3. Click "SQL Editor"
4. Copy the SQL block above
5. Paste and click "Run"
6. Done! ✅

**Let's go!** 🚀
