# 🔐 RLS Visual Guide - Understanding the Policies

## How RLS Works

```
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Database                         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  verified_vibe_users Table                           │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │ id (UUID)  │ name      │ gender │ archetype   │  │  │
│  │  ├────────────────────────────────────────────────┤  │  │
│  │  │ user-123   │ Alice     │ F      │ Adventurer  │  │  │
│  │  │ user-456   │ Bob       │ M      │ Intellectual│  │  │
│  │  │ user-789   │ Charlie   │ M      │ Romantic    │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │                                                       │  │
│  │  RLS POLICY: "Users can view own profile"           │  │
│  │  ✅ Alice (user-123) can see Alice's row            │  │
│  │  ❌ Alice (user-123) cannot see Bob's row           │  │
│  │  ❌ Alice (user-123) cannot see Charlie's row       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Policy Types

### 1️⃣ SELECT Policy (View Data)

```
User Query: SELECT * FROM verified_vibe_users WHERE id = auth.uid()

┌─────────────────────────────────────────┐
│ RLS Policy Check                        │
├─────────────────────────────────────────┤
│ auth.uid() = id ?                       │
│                                         │
│ ✅ YES → Return row                    │
│ ❌ NO  → Hide row (return 0 rows)      │
└─────────────────────────────────────────┘
```

### 2️⃣ INSERT Policy (Create Data)

```
User Query: INSERT INTO verified_vibe_likes (user_id, liked_user_id)
            VALUES (auth.uid(), 'user-456')

┌─────────────────────────────────────────┐
│ RLS Policy Check (WITH CHECK)           │
├─────────────────────────────────────────┤
│ auth.uid() = user_id ?                  │
│                                         │
│ ✅ YES → Insert allowed                │
│ ❌ NO  → Insert rejected                │
└─────────────────────────────────────────┘
```

### 3️⃣ UPDATE Policy (Edit Data)

```
User Query: UPDATE verified_vibe_users SET bio = 'New bio'
            WHERE id = auth.uid()

┌─────────────────────────────────────────┐
│ RLS Policy Check                        │
├─────────────────────────────────────────┤
│ auth.uid() = id ?                       │
│                                         │
│ ✅ YES → Update allowed                │
│ ❌ NO  → Update rejected                │
└─────────────────────────────────────────┘
```

### 4️⃣ DELETE Policy (Remove Data)

```
User Query: DELETE FROM verified_vibe_likes
            WHERE id = 'like-123' AND user_id = auth.uid()

┌─────────────────────────────────────────┐
│ RLS Policy Check                        │
├─────────────────────────────────────────┤
│ auth.uid() = user_id ?                  │
│                                         │
│ ✅ YES → Delete allowed                │
│ ❌ NO  → Delete rejected                │
└─────────────────────────────────────────┘
```

---

## Real-World Examples

### Example 1: User Viewing Their Profile

```
Alice (user-123) logs in and queries:
SELECT * FROM verified_vibe_users WHERE id = auth.uid()

┌──────────────────────────────────────────────────────┐
│ Step 1: Database receives query                      │
│ Step 2: Check RLS policy                            │
│         auth.uid() = 'user-123'                     │
│         id = 'user-123'                             │
│         ✅ MATCH!                                    │
│ Step 3: Return Alice's profile row                  │
└──────────────────────────────────────────────────────┘

Result: ✅ Alice sees her profile
```

### Example 2: User Trying to View Another User's Profile

```
Alice (user-123) tries to query:
SELECT * FROM verified_vibe_users WHERE id = 'user-456'

┌──────────────────────────────────────────────────────┐
│ Step 1: Database receives query                      │
│ Step 2: Check RLS policy                            │
│         auth.uid() = 'user-123'                     │
│         id = 'user-456'                             │
│         ❌ NO MATCH!                                 │
│ Step 3: Hide row (return 0 rows)                    │
└──────────────────────────────────────────────────────┘

Result: ❌ Alice cannot see Bob's profile
```

### Example 3: User Creating a Like

```
Alice (user-123) tries to like Bob:
INSERT INTO verified_vibe_likes (user_id, liked_user_id)
VALUES ('user-123', 'user-456')

┌──────────────────────────────────────────────────────┐
│ Step 1: Database receives INSERT                     │
│ Step 2: Check RLS policy (WITH CHECK)               │
│         auth.uid() = 'user-123'                     │
│         user_id = 'user-123'                        │
│         ✅ MATCH!                                    │
│ Step 3: Insert the like record                      │
└──────────────────────────────────────────────────────┘

Result: ✅ Like created successfully
```

### Example 4: User Trying to Create a Like for Someone Else

```
Alice (user-123) tries to cheat:
INSERT INTO verified_vibe_likes (user_id, liked_user_id)
VALUES ('user-456', 'user-789')

┌──────────────────────────────────────────────────────┐
│ Step 1: Database receives INSERT                     │
│ Step 2: Check RLS policy (WITH CHECK)               │
│         auth.uid() = 'user-123'                     │
│         user_id = 'user-456'                        │
│         ❌ NO MATCH!                                 │
│ Step 3: Reject the INSERT                           │
└──────────────────────────────────────────────────────┘

Result: ❌ Insert rejected (cannot create likes for others)
```

---

## Match Privacy Example

```
verified_vibe_matches Table:
┌──────────────────────────────────────────────────────┐
│ id        │ user1_id  │ user2_id  │ created_at      │
├──────────────────────────────────────────────────────┤
│ match-1   │ user-123  │ user-456  │ 2026-05-20      │
│ match-2   │ user-456  │ user-789  │ 2026-05-20      │
│ match-3   │ user-123  │ user-789  │ 2026-05-20      │
└──────────────────────────────────────────────────────┘

RLS Policy: "Users can view own matches"
USING (auth.uid() = user1_id OR auth.uid() = user2_id)

Alice (user-123) queries:
SELECT * FROM verified_vibe_matches

┌──────────────────────────────────────────────────────┐
│ Check match-1: user1_id='user-123' OR user2_id='user-456'
│ auth.uid()='user-123' → ✅ MATCH! (user1_id matches)
│ Result: Show match-1
│
│ Check match-2: user1_id='user-456' OR user2_id='user-789'
│ auth.uid()='user-123' → ❌ NO MATCH
│ Result: Hide match-2
│
│ Check match-3: user1_id='user-123' OR user2_id='user-789'
│ auth.uid()='user-123' → ✅ MATCH! (user1_id matches)
│ Result: Show match-3
└──────────────────────────────────────────────────────┘

Result: Alice sees only match-1 and match-3 (her matches)
```

---

## Message Privacy Example

```
verified_vibe_messages Table:
┌──────────────────────────────────────────────────────┐
│ id        │ sender_id │ recipient_id │ message      │
├──────────────────────────────────────────────────────┤
│ msg-1     │ user-123  │ user-456     │ "Hi Bob!"    │
│ msg-2     │ user-456  │ user-123     │ "Hi Alice!"  │
│ msg-3     │ user-456  │ user-789     │ "Hi Charlie!"│
└──────────────────────────────────────────────────────┘

RLS Policy: "Users can view own messages"
USING (auth.uid() = sender_id OR auth.uid() = recipient_id)

Alice (user-123) queries:
SELECT * FROM verified_vibe_messages

┌──────────────────────────────────────────────────────┐
│ Check msg-1: sender_id='user-123' OR recipient_id='user-456'
│ auth.uid()='user-123' → ✅ MATCH! (sender_id matches)
│ Result: Show msg-1
│
│ Check msg-2: sender_id='user-456' OR recipient_id='user-123'
│ auth.uid()='user-123' → ✅ MATCH! (recipient_id matches)
│ Result: Show msg-2
│
│ Check msg-3: sender_id='user-456' OR recipient_id='user-789'
│ auth.uid()='user-123' → ❌ NO MATCH
│ Result: Hide msg-3
└──────────────────────────────────────────────────────┘

Result: Alice sees only msg-1 and msg-2 (her messages)
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    User Application                         │
│                                                              │
│  Alice logs in → auth.uid() = 'user-123'                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Client                          │
│                                                              │
│  Sends query with auth token                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Supabase API                             │
│                                                              │
│  Extracts auth.uid() from token                            │
│  Passes to database                                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                      │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ RLS Engine                                          │   │
│  │                                                     │   │
│  │ For each row in result set:                        │   │
│  │   1. Check RLS policy                              │   │
│  │   2. Evaluate: auth.uid() = id ?                   │   │
│  │   3. If YES → Include row                          │   │
│  │   4. If NO  → Exclude row                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Return filtered result set                                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Supabase API                             │
│                                                              │
│  Return filtered data to client                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    User Application                         │
│                                                              │
│  Display only Alice's data (other data filtered out)       │
└─────────────────────────────────────────────────────────────┘
```

---

## Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Authentication                                     │
│ ├─ User logs in with email/password                        │
│ ├─ Supabase issues JWT token with auth.uid()              │
│ └─ Token sent with every request                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Authorization (RLS Policies)                       │
│ ├─ Database checks RLS policies                            │
│ ├─ Filters rows based on auth.uid()                        │
│ └─ Only returns rows user is allowed to see                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Application Logic                                  │
│ ├─ Backend validates user permissions                      │
│ ├─ Frontend checks user state                              │
│ └─ Additional business logic checks                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Before vs After RLS

### Before RLS (Vulnerable)
```
┌─────────────────────────────────────────────────────────────┐
│ Alice's Query: SELECT * FROM verified_vibe_users            │
│                                                              │
│ Database Response:                                          │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ id        │ name      │ gender │ archetype          │   │
│ ├──────────────────────────────────────────────────────┤   │
│ │ user-123  │ Alice     │ F      │ Adventurer         │   │
│ │ user-456  │ Bob       │ M      │ Intellectual       │   │
│ │ user-789  │ Charlie   │ M      │ Romantic           │   │
│ │ ...       │ ...       │ ...    │ ...                │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ ❌ PROBLEM: Alice can see ALL users' data!                 │
└─────────────────────────────────────────────────────────────┘
```

### After RLS (Secure)
```
┌─────────────────────────────────────────────────────────────┐
│ Alice's Query: SELECT * FROM verified_vibe_users            │
│                                                              │
│ Database Response (with RLS):                              │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ id        │ name      │ gender │ archetype          │   │
│ ├──────────────────────────────────────────────────────┤   │
│ │ user-123  │ Alice     │ F      │ Adventurer         │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ ✅ SECURE: Alice can only see her own data!               │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary

```
RLS = Row Level Security

✅ Filters data at the database level
✅ Based on authenticated user (auth.uid())
✅ Transparent to application code
✅ Prevents unauthorized data access
✅ Works with SELECT, INSERT, UPDATE, DELETE

Key Concept:
  auth.uid() = the ID of the logged-in user
  
  If auth.uid() matches the row's user_id → ✅ Show row
  If auth.uid() doesn't match → ❌ Hide row
```

---

**Visual Guide Complete!** 🎨

For implementation, see **RLS_QUICK_REFERENCE.md** ⭐
