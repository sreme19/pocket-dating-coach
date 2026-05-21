# RLS Quick Reference Guide

## What is RLS?

Row-Level Security (RLS) is a database feature that restricts which rows users can access based on their identity. In our case, users can only access their own data.

## Tables Protected

| Table | Purpose | Policy |
|-------|---------|--------|
| `ai_assistant_profiles` | User preferences/personality | Users can only access their own profiles |
| `ai_assistant_conversations` | Chat history with AI | Users can only access their own conversations |
| `ai_assistant_summaries` | Daily match summaries | Users can only access their own summaries |
| `ai_assistant_configs` | Assistant settings | Users can only access their own configs |

## How It Works

```
User A logs in → auth.uid() = 'user-a-id'
User A queries: SELECT * FROM ai_assistant_profiles
RLS checks: WHERE auth.uid() = user_id
Result: Only rows where user_id = 'user-a-id' are returned
```

## Policy Pattern

Every table has 4 policies:

```sql
-- SELECT: View own data
USING (auth.uid() = user_id)

-- INSERT: Create own data
WITH CHECK (auth.uid() = user_id)

-- UPDATE: Modify own data
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)

-- DELETE: Remove own data
USING (auth.uid() = user_id)
```

## Testing

### Run All Tests
```bash
npm run test -- src/lib/server/__tests__/rls-policies.test.ts
```

### Run Specific Table Tests
```bash
npm run test -- src/lib/server/__tests__/rls-policies.test.ts -t "ai_assistant_profiles"
```

## Applying Migration

### Option 1: Supabase CLI
```bash
supabase db push
```

### Option 2: Manual
1. Go to Supabase Dashboard → SQL Editor
2. Copy `supabase/migrations/20260520_enable_rls_ai_assistant_tables.sql`
3. Paste and run

## Verify RLS is Enabled

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN (
  'ai_assistant_profiles',
  'ai_assistant_conversations',
  'ai_assistant_summaries',
  'ai_assistant_configs'
);
```

Should show `rowsecurity = true` for all tables.

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Permission denied" | RLS blocking query | Verify `user_id` matches `auth.uid()` |
| Cannot insert data | RLS blocking insert | Set `user_id` to your own ID |
| Cannot update data | RLS blocking update | Verify row belongs to you |
| Cannot delete data | RLS blocking delete | Verify row belongs to you |

## Security Guarantees

✅ Users can only access their own data
✅ Users cannot access other users' data
✅ Users cannot modify other users' data
✅ Users cannot delete other users' data
✅ All operations require authentication

## Files

- **Migration:** `supabase/migrations/20260520_enable_rls_ai_assistant_tables.sql`
- **Tests:** `src/lib/server/__tests__/rls-policies.test.ts`
- **Docs:** `docs/RLS_POLICIES_DOCUMENTATION.md`
- **Summary:** `RLS_CONFIGURATION_SUMMARY.md`

## More Info

See `docs/RLS_POLICIES_DOCUMENTATION.md` for complete documentation.
