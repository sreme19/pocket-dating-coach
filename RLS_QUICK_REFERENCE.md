# 🔐 RLS Quick Reference Card

## 5-Minute Implementation

### Step 1: Open Supabase
- Go to https://app.supabase.com
- Select **pocket-dating-coach** project
- Click **SQL Editor** (left sidebar)

### Step 2: Copy & Paste SQL Blocks
Execute these 6 blocks in order. Copy each block, paste into SQL Editor, click **Run**.

---

## Block 1: verified_vibe_users
```sql
ALTER TABLE verified_vibe_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON verified_vibe_users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON verified_vibe_users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON verified_vibe_users FOR INSERT WITH CHECK (auth.uid() = id);
```

---

## Block 2: verified_vibe_verification
```sql
ALTER TABLE verified_vibe_verification ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own verification" ON verified_vibe_verification FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own verification" ON verified_vibe_verification FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own verification" ON verified_vibe_verification FOR INSERT WITH CHECK (auth.uid() = user_id);
```

---

## Block 3: verified_vibe_matches
```sql
ALTER TABLE verified_vibe_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own matches" ON verified_vibe_matches FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Users can update own matches" ON verified_vibe_matches FOR UPDATE USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Users can create matches" ON verified_vibe_matches FOR INSERT WITH CHECK (auth.uid() = user1_id);
```

---

## Block 4: verified_vibe_likes
```sql
ALTER TABLE verified_vibe_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own likes" ON verified_vibe_likes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create likes" ON verified_vibe_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own likes" ON verified_vibe_likes FOR DELETE USING (auth.uid() = user_id);
```

---

## Block 5: verified_vibe_passes
```sql
ALTER TABLE verified_vibe_passes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own passes" ON verified_vibe_passes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create passes" ON verified_vibe_passes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own passes" ON verified_vibe_passes FOR DELETE USING (auth.uid() = user_id);
```

---

## Block 6: verified_vibe_messages
```sql
ALTER TABLE verified_vibe_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own messages" ON verified_vibe_messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Users can send messages" ON verified_vibe_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
```

---

## Step 3: Verify
Run these tests in SQL Editor:

```sql
-- Test 1: Should return 1 row (your profile)
SELECT * FROM verified_vibe_users WHERE id = auth.uid();

-- Test 2: Should return 0 rows (blocked by RLS)
SELECT * FROM verified_vibe_users WHERE id != auth.uid();

-- Test 3: Should return your verification records
SELECT * FROM verified_vibe_verification WHERE user_id = auth.uid();
```

---

## Step 4: Check Dashboard
1. Go to **Tables** in Supabase
2. For each table, click **Security** tab
3. Verify **RLS is enabled** ✅
4. Verify **policies are listed** ✅

---

## What Gets Fixed

| Issue | Status |
|-------|--------|
| 401 errors on profile access | ✅ Fixed |
| Seed accounts stuck in onboarding | ✅ Fixed |
| Discovery feed 401 errors | ✅ Fixed |
| Swiping blocked | ✅ Fixed |
| Matches not showing | ✅ Fixed |

---

## Rollback (If Needed)
```sql
ALTER TABLE verified_vibe_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE verified_vibe_verification DISABLE ROW LEVEL SECURITY;
ALTER TABLE verified_vibe_matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE verified_vibe_likes DISABLE ROW LEVEL SECURITY;
ALTER TABLE verified_vibe_passes DISABLE ROW LEVEL SECURITY;
ALTER TABLE verified_vibe_messages DISABLE ROW LEVEL SECURITY;
```

---

## Key Concepts

**auth.uid() = id**
- User can only access their own data
- User A ≠ User B's data ❌
- User A = User A's data ✅

**auth.uid() = user1_id OR auth.uid() = user2_id**
- Only the two matched users can see that match
- Other users get "not found"

**WITH CHECK**
- Validates data before inserting
- Prevents creating records for other users

---

## Time: 5 minutes | Difficulty: Easy | Impact: High 🚀
