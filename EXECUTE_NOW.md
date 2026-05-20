# 🚀 EXECUTE NOW - RLS Configuration

**Status**: ✅ Ready to Execute  
**Time**: 5-10 minutes  
**Difficulty**: Low (copy-paste SQL)  

---

## ⚡ Quick Start (Do This Now)

### Step 1: Open Supabase Dashboard
```
https://app.supabase.com
```

### Step 2: Select Project
- Click on **pocket-dating-coach** project

### Step 3: Open SQL Editor
- Click **SQL Editor** (left sidebar)

### Step 4: Copy & Execute SQL Blocks
Open **RLS_QUICK_REFERENCE.md** in this directory and copy each SQL block.

For each block:
1. Copy the SQL code
2. Paste into Supabase SQL Editor
3. Click **Run**
4. Wait for success message
5. Move to next block

**Total: 6 blocks to execute**

---

## 📋 The 6 SQL Blocks

### Block 1: verified_vibe_users
```sql
ALTER TABLE verified_vibe_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON verified_vibe_users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON verified_vibe_users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON verified_vibe_users FOR INSERT WITH CHECK (auth.uid() = id);
```

### Block 2: verified_vibe_verification
```sql
ALTER TABLE verified_vibe_verification ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own verification" ON verified_vibe_verification FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own verification" ON verified_vibe_verification FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own verification" ON verified_vibe_verification FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### Block 3: verified_vibe_matches
```sql
ALTER TABLE verified_vibe_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own matches" ON verified_vibe_matches FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Users can update own matches" ON verified_vibe_matches FOR UPDATE USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Users can create matches" ON verified_vibe_matches FOR INSERT WITH CHECK (auth.uid() = user1_id);
```

### Block 4: verified_vibe_likes
```sql
ALTER TABLE verified_vibe_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own likes" ON verified_vibe_likes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create likes" ON verified_vibe_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own likes" ON verified_vibe_likes FOR DELETE USING (auth.uid() = user_id);
```

### Block 5: verified_vibe_passes
```sql
ALTER TABLE verified_vibe_passes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own passes" ON verified_vibe_passes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create passes" ON verified_vibe_passes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own passes" ON verified_vibe_passes FOR DELETE USING (auth.uid() = user_id);
```

### Block 6: verified_vibe_messages
```sql
ALTER TABLE verified_vibe_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own messages" ON verified_vibe_messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Users can send messages" ON verified_vibe_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
```

---

## ✅ Verification Tests

After executing all 6 blocks, run these tests in SQL Editor:

### Test 1: User can see their own profile
```sql
SELECT * FROM verified_vibe_users WHERE id = auth.uid();
```
**Expected**: Returns 1 row (the authenticated user's profile)

### Test 2: User CANNOT see other users' profiles
```sql
SELECT * FROM verified_vibe_users WHERE id != auth.uid();
```
**Expected**: Returns 0 rows (RLS blocks access)

### Test 3: Verification data is isolated
```sql
SELECT * FROM verified_vibe_verification WHERE user_id = auth.uid();
```
**Expected**: Returns only the authenticated user's verification records

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

## 📍 Database Details

| Property | Value |
|----------|-------|
| Supabase URL | https://app.supabase.com |
| Project | pocket-dating-coach |
| Tables | 6 (users, verification, matches, likes, passes, messages) |

---

## 🚀 Next Steps

1. **Go to**: https://app.supabase.com
2. **Select**: pocket-dating-coach project
3. **Click**: SQL Editor
4. **Copy**: Each SQL block from this file or RLS_QUICK_REFERENCE.md
5. **Paste**: Into SQL Editor
6. **Click**: Run
7. **Repeat**: For all 6 blocks
8. **Verify**: Run the 3 verification tests

---

## ⏱️ Timeline

- **Copy Block 1**: 30 seconds
- **Execute Block 1**: 5 seconds
- **Repeat for Blocks 2-6**: 3 minutes
- **Run Verification Tests**: 1 minute
- **Total**: 5-10 minutes

---

## ✅ Success Indicators

After execution:
- ✅ All 6 SQL blocks executed without errors
- ✅ Verification tests return expected results
- ✅ Supabase Dashboard shows RLS enabled for each table
- ✅ Seed account login works
- ✅ Profile access works
- ✅ Discovery feed works
- ✅ Swiping (like/pass) works

---

## 📚 Additional Resources

- **RLS_QUICK_REFERENCE.md** - Quick reference with all SQL blocks
- **RLS_CONFIGURATION_GUIDE.md** - Detailed step-by-step guide
- **RLS_VISUAL_GUIDE.md** - Visual diagrams and examples
- **START_HERE.md** - Overview and learning paths

---

**Ready? Go to https://app.supabase.com and start executing! 🚀**
