# AI Assistant Tables Migration - Test & Validation Guide

## Migration File
- **Location**: `supabase/migrations/20260520_create_ai_assistant_tables.sql`
- **Status**: ✅ Created and ready for deployment

## Tables Created

### 1. ai_assistant_profiles
**Purpose**: Stores user preferences.md (female) and personality.md (male) with version history

**Schema**:
```sql
CREATE TABLE ai_assistant_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_type TEXT NOT NULL CHECK (profile_type IN ('preferences', 'personality')),
  data JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  is_current BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, profile_type, version)
);
```

**Indexes**:
- `idx_ai_profiles_user_type`: (user_id, profile_type) - Quick lookup by user and type
- `idx_ai_profiles_updated`: (updated_at DESC) - Sort by update time
- `idx_ai_profiles_current`: (user_id, profile_type) WHERE is_current = TRUE - Find current version

**Key Features**:
- Version history tracking with reason field
- Current version flag for quick access
- JSONB storage for flexible profile data
- Cascade delete on user deletion

---

### 2. ai_assistant_conversations
**Purpose**: Stores conversation history between user and AI assistant

**Schema**:
```sql
CREATE TABLE ai_assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_conversation_id TEXT NOT NULL,
  assistant_type TEXT NOT NULL CHECK (assistant_type IN ('bestie', 'wingman')),
  messages JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  exchange_count INTEGER DEFAULT 0,
  last_exchange_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, match_conversation_id, assistant_type)
);
```

**Indexes**:
- `idx_ai_conversations_user`: (user_id) - Find all conversations for a user
- `idx_ai_conversations_active`: (is_active) - Filter active conversations
- `idx_ai_conversations_match`: (match_conversation_id) - Find by match ID
- `idx_ai_conversations_updated`: (updated_at DESC) - Sort by recency

**Key Features**:
- One conversation per user-match-assistant combination (UNIQUE constraint)
- JSONB array for flexible message storage
- Exchange counter for AI Loop Prevention
- Active status tracking
- Cascade delete on user deletion

---

### 3. ai_assistant_summaries
**Purpose**: Stores hourly/daily summaries of all matches with AI Bestie insights

**Schema**:
```sql
CREATE TABLE ai_assistant_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, DATE(created_at))
);
```

**Indexes**:
- `idx_summaries_user_date`: (user_id, created_at DESC) - Find summaries by user and date

**Key Features**:
- One summary per user per day (UNIQUE constraint on date)
- JSONB storage for flexible summary data
- Automatic deduplication by date
- Cascade delete on user deletion

---

### 4. ai_assistant_configs
**Purpose**: Stores assistant settings and configuration for each user

**Schema**:
```sql
CREATE TABLE ai_assistant_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assistant_type TEXT NOT NULL CHECK (assistant_type IN ('bestie', 'wingman')),
  config_data JSONB NOT NULL DEFAULT '{}',
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, assistant_type)
);
```

**Indexes**:
- `idx_ai_configs_user_type`: (user_id, assistant_type) - Find config by user and assistant type

**Key Features**:
- One config per user-assistant combination (UNIQUE constraint)
- Enable/disable status tracking
- JSONB storage for flexible configuration
- Cascade delete on user deletion

---

## Deployment Instructions

### Option 1: Using Supabase CLI (Recommended)

1. **Link your project** (if not already linked):
   ```bash
   supabase link --project-ref stikoktiaxqtcsohcxzp
   ```

2. **Push the migration**:
   ```bash
   supabase db push
   ```

3. **Verify the migration**:
   ```bash
   supabase db list
   ```

### Option 2: Using Supabase SQL Editor (Manual)

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project: `stikoktiaxqtcsohcxzp`
3. Navigate to **SQL Editor**
4. Create a new query
5. Copy the entire contents of `supabase/migrations/20260520_create_ai_assistant_tables.sql`
6. Paste into the SQL editor
7. Click **Run**
8. Verify all tables are created

### Option 3: Using psql (Direct Database Connection)

```bash
psql -h stikoktiaxqtcsohcxzp.supabase.co \
     -U postgres \
     -d postgres \
     -f supabase/migrations/20260520_create_ai_assistant_tables.sql
```

---

## Verification Queries

### Verify Tables Exist

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'ai_assistant%'
ORDER BY table_name;
```

**Expected Output**:
```
ai_assistant_configs
ai_assistant_conversations
ai_assistant_profiles
ai_assistant_summaries
```

### Verify Indexes Exist

```sql
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename LIKE 'ai_assistant%'
ORDER BY tablename, indexname;
```

**Expected Output**:
```
idx_ai_configs_user_type              | ai_assistant_configs
idx_ai_conversations_active           | ai_assistant_conversations
idx_ai_conversations_match            | ai_assistant_conversations
idx_ai_conversations_updated          | ai_assistant_conversations
idx_ai_conversations_user             | ai_assistant_conversations
idx_ai_profiles_current               | ai_assistant_profiles
idx_ai_profiles_updated               | ai_assistant_profiles
idx_ai_profiles_user_type             | ai_assistant_profiles
idx_summaries_user_date               | ai_assistant_summaries
```

### Verify Table Structure

```sql
-- Check ai_assistant_profiles columns
\d ai_assistant_profiles

-- Check ai_assistant_conversations columns
\d ai_assistant_conversations

-- Check ai_assistant_summaries columns
\d ai_assistant_summaries

-- Check ai_assistant_configs columns
\d ai_assistant_configs
```

---

## Test Cases

### Test 1: Insert Profile with Version History

```sql
-- Insert a preferences profile
INSERT INTO ai_assistant_profiles (user_id, profile_type, data, version, reason, is_current)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'preferences',
  '{"emotionalSignals": ["Asks about my day"], "boundaries": ["No excessive drinking"]}'::jsonb,
  1,
  'Initial profile creation',
  true
);

-- Verify insertion
SELECT * FROM ai_assistant_profiles 
WHERE user_id = '550e8400-e29b-41d4-a716-446655440000'::uuid;
```

### Test 2: Insert Conversation with Messages

```sql
-- Insert a conversation
INSERT INTO ai_assistant_conversations (user_id, match_conversation_id, assistant_type, messages, is_active)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'match_123',
  'bestie',
  '[{"role": "user", "content": "What should I say?"}, {"role": "assistant", "content": "Try this..."}]'::jsonb,
  true
);

-- Verify insertion
SELECT * FROM ai_assistant_conversations 
WHERE user_id = '550e8400-e29b-41d4-a716-446655440000'::uuid;
```

### Test 3: Insert Summary

```sql
-- Insert a summary
INSERT INTO ai_assistant_summaries (user_id, summary_data)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  '{"matches": [{"name": "John", "greenFlags": ["Asks questions"], "redFlags": []}]}'::jsonb
);

-- Verify insertion
SELECT * FROM ai_assistant_summaries 
WHERE user_id = '550e8400-e29b-41d4-a716-446655440000'::uuid;
```

### Test 4: Insert Config

```sql
-- Insert a config
INSERT INTO ai_assistant_configs (user_id, assistant_type, config_data, is_enabled)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'bestie',
  '{"autoImpersonate": false, "rateLimit": 10}'::jsonb,
  true
);

-- Verify insertion
SELECT * FROM ai_assistant_configs 
WHERE user_id = '550e8400-e29b-41d4-a716-446655440000'::uuid;
```

### Test 5: Verify UNIQUE Constraints

```sql
-- This should fail (duplicate profile version)
INSERT INTO ai_assistant_profiles (user_id, profile_type, data, version, reason, is_current)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'preferences',
  '{"emotionalSignals": ["Different data"]}'::jsonb,
  1,
  'Duplicate version',
  false
);
-- Expected: ERROR: duplicate key value violates unique constraint
```

### Test 6: Verify CHECK Constraints

```sql
-- This should fail (invalid profile_type)
INSERT INTO ai_assistant_profiles (user_id, profile_type, data, version, reason, is_current)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'invalid_type',
  '{"data": "test"}'::jsonb,
  2,
  'Invalid type',
  false
);
-- Expected: ERROR: new row for relation "ai_assistant_profiles" violates check constraint
```

### Test 7: Verify Foreign Key Cascade

```sql
-- Delete a user (this should cascade delete all related records)
DELETE FROM auth.users WHERE id = '550e8400-e29b-41d4-a716-446655440000'::uuid;

-- Verify all related records are deleted
SELECT COUNT(*) FROM ai_assistant_profiles 
WHERE user_id = '550e8400-e29b-41d4-a716-446655440000'::uuid;
-- Expected: 0
```

### Test 8: Verify Indexes Work

```sql
-- Query using index on user_id
EXPLAIN ANALYZE
SELECT * FROM ai_assistant_conversations 
WHERE user_id = '550e8400-e29b-41d4-a716-446655440000'::uuid;
-- Expected: Should use idx_ai_conversations_user index

-- Query using index on is_active
EXPLAIN ANALYZE
SELECT * FROM ai_assistant_conversations 
WHERE is_active = true;
-- Expected: Should use idx_ai_conversations_active index
```

---

## Performance Considerations

### Index Strategy
- **User lookups**: `idx_ai_profiles_user_type`, `idx_ai_conversations_user` - Fast user-specific queries
- **Filtering**: `idx_ai_conversations_active` - Quick filtering of active conversations
- **Sorting**: `idx_ai_profiles_updated`, `idx_ai_conversations_updated` - Efficient ordering
- **Current version**: `idx_ai_profiles_current` - Filtered index for current profiles only

### Query Optimization Tips
1. Always filter by `user_id` first (indexed)
2. Use `is_active = true` to filter active conversations
3. Use `is_current = true` to get current profile version
4. Order by `updated_at DESC` for recent items
5. Use `DATE(created_at)` for daily summaries

---

## Rollback Instructions

If you need to rollback this migration:

```sql
DROP TABLE IF EXISTS ai_assistant_configs CASCADE;
DROP TABLE IF EXISTS ai_assistant_summaries CASCADE;
DROP TABLE IF EXISTS ai_assistant_conversations CASCADE;
DROP TABLE IF EXISTS ai_assistant_profiles CASCADE;
```

---

## Requirements Addressed

This migration implements the database schema for:
- **Requirement 1.1**: AI Bestie Activation and Session Initialization
- **Requirement 1.2**: AI Wingman Activation and Session Initialization
- **Requirement 8.1**: Chat History Persistence and Retrieval
- **Requirement 12.1**: Profile Data Loading and Caching

---

## Next Steps

1. **Deploy the migration** using one of the methods above
2. **Verify all tables and indexes** using the verification queries
3. **Run test cases** to ensure everything works correctly
4. **Update application code** to use these tables:
   - Create TypeScript interfaces for each table
   - Implement database service functions
   - Add RLS (Row Level Security) policies
   - Create API endpoints for CRUD operations

---

## Support

For issues or questions:
1. Check the Supabase logs in the dashboard
2. Verify the migration file syntax
3. Ensure the Supabase project is accessible
4. Check that auth.users table exists and is accessible
