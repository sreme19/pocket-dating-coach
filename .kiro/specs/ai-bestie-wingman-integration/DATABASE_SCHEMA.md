# Database Schema - AI Bestie & AI Wingman Integration

## Overview

This document provides detailed database schema for AI Bestie and AI Wingman integration. All tables use PostgreSQL with Supabase.

---

## Table: `ai_assistant_profiles`

Stores user profiles for AI assistants (preferences.md for Bestie, personality.md for Wingman).

```sql
create table if not exists ai_assistant_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references verified_vibe_users(id) on delete cascade,
  assistant_type text not null check (assistant_type in ('bestie', 'wingman')),
  
  -- Current profile data (JSONB for flexibility)
  profile_data jsonb not null default '{}'::jsonb,
  
  -- Version tracking
  version integer not null default 1,
  version_history jsonb not null default '[]'::jsonb,
  
  -- Metadata
  last_updated_at timestamp with time zone default now(),
  last_updated_by text not null check (last_updated_by in ('user', 'ai')),
  
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  unique(user_id, assistant_type)
);

create index if not exists ai_assistant_profiles_user_idx on ai_assistant_profiles(user_id);
create index if not exists ai_assistant_profiles_type_idx on ai_assistant_profiles(assistant_type);
create index if not exists ai_assistant_profiles_updated_idx on ai_assistant_profiles(last_updated_at);
```

### Profile Data Schema (JSONB)

**For AI Bestie (preferences.md)**:
```json
{
  "emotionalSignals": ["string"],
  "lifestyleSignals": ["string"],
  "maturitySignals": ["string"],
  "boundaries": ["string"],
  "dealbreakers": ["string"],
  "privateCompatibilityNotes": ["string"],
  "sensitiveTranslations": [
    {
      "raw": "string",
      "translated": "string"
    }
  ]
}
```

**For AI Wingman (personality.md)**:
```json
{
  "communicationStyle": "string",
  "personalityVibe": "string",
  "mattersMost": "string",
  "strengths": ["string"],
  "values": ["string"],
  "dealbreakers": ["string"],
  "conversationStarters": ["string"]
}
```

### Version History Schema (JSONB Array)

```json
[
  {
    "id": "uuid",
    "version": 1,
    "profile": { /* profile data */ },
    "changeReason": "string",
    "createdAt": 1704067200000,
    "createdBy": "user" | "ai"
  },
  {
    "id": "uuid",
    "version": 2,
    "profile": { /* profile data */ },
    "changeReason": "string",
    "createdAt": 1704067300000,
    "createdBy": "ai"
  }
]
```

---

## Table: `ai_assistant_configs`

Stores configuration for AI assistants per match (activation status, auto-impersonate, loop prevention).

```sql
create table if not exists ai_assistant_configs (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references verified_vibe_matches(id) on delete cascade,
  user_id uuid not null references verified_vibe_users(id) on delete cascade,
  assistant_type text not null check (assistant_type in ('bestie', 'wingman')),
  
  -- Configuration
  is_active boolean not null default false,
  auto_impersonate boolean not null default false,
  
  -- Loop prevention
  exchange_count integer not null default 0,
  last_exchange_at timestamp with time zone,
  
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  unique(match_id, user_id, assistant_type)
);

create index if not exists ai_assistant_configs_match_idx on ai_assistant_configs(match_id);
create index if not exists ai_assistant_configs_user_idx on ai_assistant_configs(user_id);
create index if not exists ai_assistant_configs_active_idx on ai_assistant_configs(is_active);
create index if not exists ai_assistant_configs_exchange_idx on ai_assistant_configs(exchange_count);
```

### Constraints

- `is_active`: Boolean flag indicating if AI is active for this match
- `auto_impersonate`: For Wingman only; enables auto-sending after 20+ messages
- `exchange_count`: Incremented each time AI generates a response; max 10 per side
- `last_exchange_at`: Timestamp of last exchange; used for 24-hour reset

---

## Table: `ai_assistant_messages`

Stores metadata for AI-sent messages (links to verified_vibe_messages, stores private analysis).

```sql
create table if not exists ai_assistant_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references verified_vibe_matches(id) on delete cascade,
  message_id uuid not null references verified_vibe_messages(id) on delete cascade,
  
  -- Message metadata
  assistant_type text not null check (assistant_type in ('bestie', 'wingman')),
  is_impersonation boolean not null default false,
  
  -- Private analysis (visible only to user)
  private_analysis jsonb not null default '{}'::jsonb,
  
  created_at timestamp with time zone default now(),
  
  unique(message_id)
);

create index if not exists ai_assistant_messages_match_idx on ai_assistant_messages(match_id);
create index if not exists ai_assistant_messages_type_idx on ai_assistant_messages(assistant_type);
create index if not exists ai_assistant_messages_impersonation_idx on ai_assistant_messages(is_impersonation);
```

### Private Analysis Schema (JSONB)

```json
{
  "flags": [
    "red_flag: ...",
    "green_flag: ...",
    "yellow_flag: ..."
  ],
  "reasoning": "string explaining why these flags matter",
  "suggestions": [
    "strategic suggestion 1",
    "strategic suggestion 2"
  ],
  "matchInsights": [
    "insight 1 about the match",
    "insight 2 about the match"
  ]
}
```

---

## Table: `match_summaries`

Stores hourly summaries of match conversations with insights and compatibility scores.

```sql
create table if not exists match_summaries (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references verified_vibe_matches(id) on delete cascade,
  user_id uuid not null references verified_vibe_users(id) on delete cascade,
  
  -- Summary data
  summary_data jsonb not null default '{}'::jsonb,
  
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  unique(match_id, user_id)
);

create index if not exists match_summaries_match_idx on match_summaries(match_id);
create index if not exists match_summaries_user_idx on match_summaries(user_id);
create index if not exists match_summaries_updated_idx on match_summaries(updated_at);
```

### Summary Data Schema (JSONB)

```json
{
  "matchId": "uuid",
  "matchName": "string",
  "lastMessageAt": 1704067200000,
  "messageCount": 42,
  "keyInsights": [
    "insight 1",
    "insight 2",
    "insight 3"
  ],
  "compatibilityScore": 75,
  "nextSteps": [
    "suggested action 1",
    "suggested action 2"
  ],
  "redFlags": [
    "red flag 1",
    "red flag 2"
  ],
  "greenFlags": [
    "green flag 1",
    "green flag 2"
  ],
  "generatedAt": 1704067200000
}
```

---

## Table: `ai_assistant_audit_log`

Stores audit trail of all AI assistant actions for compliance and debugging.

```sql
create table if not exists ai_assistant_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references verified_vibe_users(id) on delete cascade,
  match_id uuid references verified_vibe_matches(id) on delete set null,
  
  -- Action details
  action text not null check (action in (
    'activate',
    'deactivate',
    'generate_response',
    'auto_update_profile',
    'generate_analysis',
    'reset_counter',
    'update_config',
    'revert_profile'
  )),
  
  assistant_type text check (assistant_type in ('bestie', 'wingman')),
  
  -- Metadata
  metadata jsonb not null default '{}'::jsonb,
  
  created_at timestamp with time zone default now()
);

create index if not exists ai_assistant_audit_log_user_idx on ai_assistant_audit_log(user_id);
create index if not exists ai_assistant_audit_log_match_idx on ai_assistant_audit_log(match_id);
create index if not exists ai_assistant_audit_log_action_idx on ai_assistant_audit_log(action);
create index if not exists ai_assistant_audit_log_created_idx on ai_assistant_audit_log(created_at);
```

### Audit Log Metadata Schema (JSONB)

```json
{
  "action": "generate_response",
  "assistantType": "bestie",
  "exchangeCount": 5,
  "loopPreventionTriggered": false,
  "responseLength": 256,
  "citationCount": 2,
  "autoUpdateApplied": true,
  "error": null,
  "duration": 2500
}
```

---

## Row-Level Security (RLS) Policies

### `ai_assistant_profiles`

```sql
-- Users can only access their own profiles
create policy "Users can access own profiles"
  on ai_assistant_profiles
  for select
  using (user_id = auth.uid());

create policy "Users can update own profiles"
  on ai_assistant_profiles
  for update
  using (user_id = auth.uid());

create policy "Users can insert own profiles"
  on ai_assistant_profiles
  for insert
  with check (user_id = auth.uid());
```

### `ai_assistant_configs`

```sql
-- Users can only access configs for their matches
create policy "Users can access own match configs"
  on ai_assistant_configs
  for select
  using (
    user_id = auth.uid() OR
    match_id IN (
      SELECT id FROM verified_vibe_matches
      WHERE user1_id = auth.uid() OR user2_id = auth.uid()
    )
  );

create policy "Users can update own match configs"
  on ai_assistant_configs
  for update
  using (user_id = auth.uid());

create policy "Users can insert own match configs"
  on ai_assistant_configs
  for insert
  with check (user_id = auth.uid());
```

### `ai_assistant_messages`

```sql
-- Users can only access messages in their matches
create policy "Users can access own match messages"
  on ai_assistant_messages
  for select
  using (
    match_id IN (
      SELECT id FROM verified_vibe_matches
      WHERE user1_id = auth.uid() OR user2_id = auth.uid()
    )
  );
```

### `match_summaries`

```sql
-- Users can only access summaries for their matches
create policy "Users can access own match summaries"
  on match_summaries
  for select
  using (user_id = auth.uid());
```

### `ai_assistant_audit_log`

```sql
-- Users can only access their own audit logs
create policy "Users can access own audit logs"
  on ai_assistant_audit_log
  for select
  using (user_id = auth.uid());
```

---

## Indexes for Performance

### Query Patterns

1. **Load profile for user**: `ai_assistant_profiles(user_id, assistant_type)`
2. **Check config for match**: `ai_assistant_configs(match_id, user_id, assistant_type)`
3. **Get AI messages for match**: `ai_assistant_messages(match_id, assistant_type)`
4. **Get latest summary**: `match_summaries(match_id, user_id)` with `ORDER BY updated_at DESC LIMIT 1`
5. **Audit trail for user**: `ai_assistant_audit_log(user_id, created_at DESC)`

### Recommended Indexes

```sql
-- ai_assistant_profiles
create index if not exists ai_assistant_profiles_user_type_idx 
  on ai_assistant_profiles(user_id, assistant_type);
create index if not exists ai_assistant_profiles_updated_idx 
  on ai_assistant_profiles(last_updated_at desc);

-- ai_assistant_configs
create index if not exists ai_assistant_configs_match_user_type_idx 
  on ai_assistant_configs(match_id, user_id, assistant_type);
create index if not exists ai_assistant_configs_active_exchange_idx 
  on ai_assistant_configs(is_active, exchange_count);

-- ai_assistant_messages
create index if not exists ai_assistant_messages_match_type_idx 
  on ai_assistant_messages(match_id, assistant_type);
create index if not exists ai_assistant_messages_created_idx 
  on ai_assistant_messages(created_at desc);

-- match_summaries
create index if not exists match_summaries_user_updated_idx 
  on match_summaries(user_id, updated_at desc);

-- ai_assistant_audit_log
create index if not exists ai_assistant_audit_log_user_created_idx 
  on ai_assistant_audit_log(user_id, created_at desc);
create index if not exists ai_assistant_audit_log_action_idx 
  on ai_assistant_audit_log(action, created_at desc);
```

---

## Data Retention Policies

### Automatic Cleanup

1. **Audit logs**: Retain for 90 days; delete older entries
2. **Version history**: Retain last 20 versions per profile; delete older versions
3. **Match summaries**: Retain for 30 days; regenerate on next hourly update

### Manual Cleanup

1. **User deletion**: Cascade delete all related records
2. **Match deletion**: Cascade delete all related records
3. **Profile reset**: Clear version history; keep current version

---

## Migration Script

```sql
-- Run this in Supabase SQL editor to create all tables

-- Enable pgcrypto for UUID generation
create extension if not exists pgcrypto;

-- AI Assistant Profiles
create table if not exists ai_assistant_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references verified_vibe_users(id) on delete cascade,
  assistant_type text not null check (assistant_type in ('bestie', 'wingman')),
  profile_data jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  version_history jsonb not null default '[]'::jsonb,
  last_updated_at timestamp with time zone default now(),
  last_updated_by text not null check (last_updated_by in ('user', 'ai')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id, assistant_type)
);

-- AI Assistant Configs
create table if not exists ai_assistant_configs (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references verified_vibe_matches(id) on delete cascade,
  user_id uuid not null references verified_vibe_users(id) on delete cascade,
  assistant_type text not null check (assistant_type in ('bestie', 'wingman')),
  is_active boolean not null default false,
  auto_impersonate boolean not null default false,
  exchange_count integer not null default 0,
  last_exchange_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(match_id, user_id, assistant_type)
);

-- AI Assistant Messages
create table if not exists ai_assistant_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references verified_vibe_matches(id) on delete cascade,
  message_id uuid not null references verified_vibe_messages(id) on delete cascade,
  assistant_type text not null check (assistant_type in ('bestie', 'wingman')),
  is_impersonation boolean not null default false,
  private_analysis jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  unique(message_id)
);

-- Match Summaries
create table if not exists match_summaries (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references verified_vibe_matches(id) on delete cascade,
  user_id uuid not null references verified_vibe_users(id) on delete cascade,
  summary_data jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(match_id, user_id)
);

-- AI Assistant Audit Log
create table if not exists ai_assistant_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references verified_vibe_users(id) on delete cascade,
  match_id uuid references verified_vibe_matches(id) on delete set null,
  action text not null check (action in (
    'activate', 'deactivate', 'generate_response', 'auto_update_profile',
    'generate_analysis', 'reset_counter', 'update_config', 'revert_profile'
  )),
  assistant_type text check (assistant_type in ('bestie', 'wingman')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

-- Create indexes
create index if not exists ai_assistant_profiles_user_idx on ai_assistant_profiles(user_id);
create index if not exists ai_assistant_profiles_type_idx on ai_assistant_profiles(assistant_type);
create index if not exists ai_assistant_profiles_updated_idx on ai_assistant_profiles(last_updated_at);
create index if not exists ai_assistant_configs_match_idx on ai_assistant_configs(match_id);
create index if not exists ai_assistant_configs_user_idx on ai_assistant_configs(user_id);
create index if not exists ai_assistant_configs_active_idx on ai_assistant_configs(is_active);
create index if not exists ai_assistant_messages_match_idx on ai_assistant_messages(match_id);
create index if not exists ai_assistant_messages_type_idx on ai_assistant_messages(assistant_type);
create index if not exists match_summaries_match_idx on match_summaries(match_id);
create index if not exists match_summaries_user_idx on match_summaries(user_id);
create index if not exists ai_assistant_audit_log_user_idx on ai_assistant_audit_log(user_id);
create index if not exists ai_assistant_audit_log_action_idx on ai_assistant_audit_log(action);
```

---

## Backup & Recovery

### Backup Strategy

1. **Daily backups**: Supabase automatically backs up all data daily
2. **Point-in-time recovery**: Available for 7 days
3. **Manual exports**: Export profiles and summaries weekly

### Recovery Procedures

1. **Profile corruption**: Revert to previous version using `revert_profile` endpoint
2. **Data loss**: Restore from daily backup via Supabase dashboard
3. **Accidental deletion**: Use point-in-time recovery within 7 days

