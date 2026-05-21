# Row-Level Security (RLS) Policies Documentation

## Overview

This document describes the Row-Level Security (RLS) policies configured for the AI Assistant tables in the Pocket Dating Coach application. RLS ensures that users can only access their own data, providing complete data isolation and privacy.

**Requirements Addressed:**
- Requirement 15.1: Data Privacy and User Consent
- Requirement 15.4: User Data Deletion and Account Deletion

---

## Tables Protected by RLS

The following 4 tables have RLS enabled with comprehensive policies:

1. **ai_assistant_profiles** - Stores user preferences.md and personality.md with version history
2. **ai_assistant_conversations** - Stores conversation history between user and AI assistant
3. **ai_assistant_summaries** - Stores hourly summaries of all matches with AI Bestie insights
4. **ai_assistant_configs** - Stores assistant settings and configuration for each user

---

## RLS Policy Pattern

All tables follow the same RLS policy pattern to ensure consistent data isolation:

### SELECT Policy
```sql
CREATE POLICY "Users can view their own [resource]" ON [table_name]
  FOR SELECT
  USING (auth.uid() = user_id);
```
**Effect:** Users can only view rows where their authenticated user ID matches the `user_id` column.

### INSERT Policy
```sql
CREATE POLICY "Users can insert their own [resource]" ON [table_name]
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```
**Effect:** Users can only insert rows where they set `user_id` to their own authenticated user ID.

### UPDATE Policy
```sql
CREATE POLICY "Users can update their own [resource]" ON [table_name]
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```
**Effect:** Users can only update rows where their authenticated user ID matches the `user_id` column, and the updated row must still have their user ID.

### DELETE Policy
```sql
CREATE POLICY "Users can delete their own [resource]" ON [table_name]
  FOR DELETE
  USING (auth.uid() = user_id);
```
**Effect:** Users can only delete rows where their authenticated user ID matches the `user_id` column.

---

## Detailed Policy Breakdown

### 1. ai_assistant_profiles Table

**Purpose:** Stores user preferences.md (for women) and personality.md (for men) with version history tracking.

**Policies:**
- `Users can view their own profiles` - SELECT
- `Users can insert their own profiles` - INSERT
- `Users can update their own profiles` - UPDATE
- `Users can delete their own profiles` - DELETE

**Data Isolation:**
- User A can only view, insert, update, and delete profiles where `user_id = User A's ID`
- User A cannot access any profiles where `user_id = User B's ID`
- Each user has complete isolation of their profile data

**Example:**
```sql
-- User A can do this:
SELECT * FROM ai_assistant_profiles WHERE user_id = 'user-a-id';

-- User A CANNOT do this (RLS blocks it):
SELECT * FROM ai_assistant_profiles WHERE user_id = 'user-b-id';
```

### 2. ai_assistant_conversations Table

**Purpose:** Stores conversation history between user and AI assistant (Bestie or Wingman).

**Policies:**
- `Users can view their own conversations` - SELECT
- `Users can insert their own conversations` - INSERT
- `Users can update their own conversations` - UPDATE
- `Users can delete their own conversations` - DELETE

**Data Isolation:**
- User A can only view, insert, update, and delete conversations where `user_id = User A's ID`
- User A cannot access any conversations where `user_id = User B's ID`
- Each user has complete isolation of their conversation history

**Example:**
```sql
-- User A can do this:
SELECT * FROM ai_assistant_conversations WHERE user_id = 'user-a-id';

-- User A CANNOT do this (RLS blocks it):
SELECT * FROM ai_assistant_conversations WHERE user_id = 'user-b-id';
```

### 3. ai_assistant_summaries Table

**Purpose:** Stores hourly summaries of all matches with AI Bestie insights.

**Policies:**
- `Users can view their own summaries` - SELECT
- `Users can insert their own summaries` - INSERT
- `Users can update their own summaries` - UPDATE
- `Users can delete their own summaries` - DELETE

**Data Isolation:**
- User A can only view, insert, update, and delete summaries where `user_id = User A's ID`
- User A cannot access any summaries where `user_id = User B's ID`
- Each user has complete isolation of their summary data

**Example:**
```sql
-- User A can do this:
SELECT * FROM ai_assistant_summaries WHERE user_id = 'user-a-id';

-- User A CANNOT do this (RLS blocks it):
SELECT * FROM ai_assistant_summaries WHERE user_id = 'user-b-id';
```

### 4. ai_assistant_configs Table

**Purpose:** Stores assistant settings and configuration for each user.

**Policies:**
- `Users can view their own configs` - SELECT
- `Users can insert their own configs` - INSERT
- `Users can update their own configs` - UPDATE
- `Users can delete their own configs` - DELETE

**Data Isolation:**
- User A can only view, insert, update, and delete configs where `user_id = User A's ID`
- User A cannot access any configs where `user_id = User B's ID`
- Each user has complete isolation of their configuration data

**Example:**
```sql
-- User A can do this:
SELECT * FROM ai_assistant_configs WHERE user_id = 'user-a-id';

-- User A CANNOT do this (RLS blocks it):
SELECT * FROM ai_assistant_configs WHERE user_id = 'user-b-id';
```

---

## How RLS Works

### Authentication Context

RLS uses `auth.uid()` to get the currently authenticated user's ID from the Supabase authentication system. This is automatically set when a user logs in.

### Policy Evaluation

When a user attempts to perform an operation (SELECT, INSERT, UPDATE, DELETE) on a table with RLS enabled:

1. **Supabase checks the user's authentication status**
   - If not authenticated, the operation is blocked
   - If authenticated, `auth.uid()` is set to the user's ID

2. **Supabase evaluates all applicable policies**
   - For SELECT: Checks if `auth.uid() = user_id` for each row
   - For INSERT: Checks if `auth.uid() = user_id` for the new row
   - For UPDATE: Checks if `auth.uid() = user_id` for the row being updated
   - For DELETE: Checks if `auth.uid() = user_id` for the row being deleted

3. **Supabase allows or blocks the operation**
   - If any policy allows the operation, it proceeds
   - If no policy allows the operation, it's blocked
   - Blocked operations return an error or empty result set

### Example Flow

**Scenario:** User A tries to view User B's profile

1. User A is authenticated with `auth.uid() = 'user-a-id'`
2. User A queries: `SELECT * FROM ai_assistant_profiles WHERE user_id = 'user-b-id'`
3. Supabase evaluates the SELECT policy: `USING (auth.uid() = user_id)`
4. For each row where `user_id = 'user-b-id'`:
   - Check: `'user-a-id' = 'user-b-id'` → FALSE
   - Row is filtered out
5. Result: Empty result set (User A sees no data)

---

## Testing RLS Policies

### Manual Testing with SQL

You can test RLS policies directly in the Supabase SQL editor:

```sql
-- Test 1: View own data (should succeed)
SELECT * FROM ai_assistant_profiles 
WHERE user_id = auth.uid();

-- Test 2: View another user's data (should return empty)
SELECT * FROM ai_assistant_profiles 
WHERE user_id = 'different-user-id';

-- Test 3: Insert own data (should succeed)
INSERT INTO ai_assistant_profiles (user_id, profile_type, data, version)
VALUES (auth.uid(), 'preferences', '{"test": true}'::jsonb, 1);

-- Test 4: Insert another user's data (should fail)
INSERT INTO ai_assistant_profiles (user_id, profile_type, data, version)
VALUES ('different-user-id', 'preferences', '{"test": true}'::jsonb, 1);
```

### Automated Testing with Vitest

Run the automated RLS policy tests:

```bash
npm run test -- src/lib/server/__tests__/rls-policies.test.ts
```

The test file includes comprehensive tests for:
- SELECT operations (viewing own vs. other users' data)
- INSERT operations (creating own vs. other users' data)
- UPDATE operations (modifying own vs. other users' data)
- DELETE operations (removing own vs. other users' data)

### Testing with Multiple User Accounts

To test RLS with multiple user accounts:

1. **Create test users in Supabase**
   - User A: `user-a@example.com`
   - User B: `user-b@example.com`

2. **Log in as User A**
   - Create some data (profiles, conversations, etc.)
   - Verify you can see your own data

3. **Log in as User B**
   - Verify you CANNOT see User A's data
   - Create your own data
   - Verify you can see your own data

4. **Log in as User A again**
   - Verify you still CANNOT see User B's data
   - Verify your data is unchanged

---

## Security Considerations

### What RLS Protects

✅ **Prevents unauthorized data access** - Users cannot query other users' data
✅ **Prevents unauthorized data modification** - Users cannot update other users' data
✅ **Prevents unauthorized data deletion** - Users cannot delete other users' data
✅ **Enforces authentication** - All operations require valid authentication
✅ **Provides complete data isolation** - Each user's data is completely isolated

### What RLS Does NOT Protect

❌ **Does not encrypt data at rest** - Data is stored in plaintext in the database
❌ **Does not encrypt data in transit** - Use HTTPS to protect data in transit
❌ **Does not protect against SQL injection** - Use parameterized queries
❌ **Does not protect against application bugs** - Application code must be secure
❌ **Does not protect against admin access** - Database admins can bypass RLS

### Best Practices

1. **Always use parameterized queries** - Prevent SQL injection attacks
2. **Always authenticate users** - Verify user identity before operations
3. **Always validate input** - Sanitize user input on the server
4. **Always use HTTPS** - Encrypt data in transit
5. **Always audit access** - Log all data access for security monitoring
6. **Always test RLS policies** - Verify policies work as expected
7. **Always keep Supabase updated** - Apply security patches promptly

---

## Migration and Deployment

### Applying RLS Policies

The RLS policies are defined in the migration file:
```
supabase/migrations/20260520_enable_rls_ai_assistant_tables.sql
```

To apply the migration:

```bash
# Using Supabase CLI
supabase db push

# Or manually in Supabase SQL editor
-- Copy and paste the migration file content
```

### Verifying RLS is Enabled

After applying the migration, verify RLS is enabled:

```sql
-- Check if RLS is enabled on each table
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN (
  'ai_assistant_profiles',
  'ai_assistant_conversations',
  'ai_assistant_summaries',
  'ai_assistant_configs'
);

-- Should return:
-- tablename                    | rowsecurity
-- ai_assistant_profiles        | t
-- ai_assistant_conversations   | t
-- ai_assistant_summaries       | t
-- ai_assistant_configs         | t
```

### Verifying Policies Exist

```sql
-- Check if policies exist on each table
SELECT tablename, policyname, permissive, cmd 
FROM pg_policies 
WHERE tablename IN (
  'ai_assistant_profiles',
  'ai_assistant_conversations',
  'ai_assistant_summaries',
  'ai_assistant_configs'
)
ORDER BY tablename, policyname;
```

---

## Troubleshooting

### Issue: "Permission denied" error when querying

**Cause:** RLS policy is blocking the query

**Solution:**
1. Verify you are authenticated
2. Verify the `user_id` in your query matches your authenticated user ID
3. Check the RLS policy definition
4. Test with a simpler query

### Issue: Cannot insert data

**Cause:** RLS policy is blocking the insert

**Solution:**
1. Verify you are authenticated
2. Verify you are setting `user_id` to your own authenticated user ID
3. Check the RLS policy definition
4. Verify the INSERT policy has `WITH CHECK (auth.uid() = user_id)`

### Issue: Cannot update data

**Cause:** RLS policy is blocking the update

**Solution:**
1. Verify you are authenticated
2. Verify the row you're updating has `user_id` matching your authenticated user ID
3. Check the RLS policy definition
4. Verify the UPDATE policy has both `USING` and `WITH CHECK` clauses

### Issue: Cannot delete data

**Cause:** RLS policy is blocking the delete

**Solution:**
1. Verify you are authenticated
2. Verify the row you're deleting has `user_id` matching your authenticated user ID
3. Check the RLS policy definition
4. Verify the DELETE policy has `USING (auth.uid() = user_id)`

---

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Pocket Dating Coach Requirements 15.1 & 15.4](../requirements.md)

---

## Acceptance Criteria Verification

### ✅ Acceptance Criterion 1: Enable RLS on all 4 tables
- [x] RLS enabled on `ai_assistant_profiles`
- [x] RLS enabled on `ai_assistant_conversations`
- [x] RLS enabled on `ai_assistant_summaries`
- [x] RLS enabled on `ai_assistant_configs`

### ✅ Acceptance Criterion 2: Users can only access their own profiles
- [x] SELECT policy: `Users can view their own profiles`
- [x] INSERT policy: `Users can insert their own profiles`
- [x] UPDATE policy: `Users can update their own profiles`
- [x] DELETE policy: `Users can delete their own profiles`

### ✅ Acceptance Criterion 3: Users can only access their own conversations
- [x] SELECT policy: `Users can view their own conversations`
- [x] INSERT policy: `Users can insert their own conversations`
- [x] UPDATE policy: `Users can update their own conversations`
- [x] DELETE policy: `Users can delete their own conversations`

### ✅ Acceptance Criterion 4: Users can only access their own summaries
- [x] SELECT policy: `Users can view their own summaries`
- [x] INSERT policy: `Users can insert their own summaries`
- [x] UPDATE policy: `Users can update their own summaries`
- [x] DELETE policy: `Users can delete their own summaries`

### ✅ Acceptance Criterion 5: Users can only access their own configs
- [x] SELECT policy: `Users can view their own configs`
- [x] INSERT policy: `Users can insert their own configs`
- [x] UPDATE policy: `Users can update their own configs`
- [x] DELETE policy: `Users can delete their own configs`

### ✅ Acceptance Criterion 6: Test policies with multiple user accounts
- [x] Automated tests in `src/lib/server/__tests__/rls-policies.test.ts`
- [x] Manual testing guide provided above
- [x] Test scenarios for all CRUD operations

---

## Summary

Row-Level Security (RLS) policies have been successfully configured on all 4 AI Assistant tables. These policies ensure complete data isolation between users, preventing unauthorized access, modification, or deletion of user data. All policies follow a consistent pattern using `auth.uid()` to verify user identity before allowing operations.

The implementation addresses Requirements 15.1 (Data Privacy) and 15.4 (User Consent) by ensuring users can only access their own data and providing mechanisms for data deletion.
