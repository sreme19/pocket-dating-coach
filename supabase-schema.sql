-- Run this in your Supabase SQL editor (Dashboard > SQL Editor > New query)

-- Enable the pgvector extension
create extension if not exists vector;

-- Book chunks table
create table if not exists book_chunks (
  id bigserial primary key,
  content text not null,
  chapter text not null default 'Unknown',
  chunk_index integer not null,
  embedding vector(512),  -- voyage-3-lite produces 512-dim embeddings
  created_at timestamp with time zone default now()
);

-- Index for fast vector similarity search
create index if not exists book_chunks_embedding_idx
  on book_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Similarity search function used by the app
create or replace function match_book_chunks (
  query_embedding vector(512),
  match_count int default 5
)
returns table (
  id bigint,
  content text,
  chapter text,
  similarity float
)
language sql stable
as $$
  select
    id,
    content,
    chapter,
    1 - (embedding <=> query_embedding) as similarity
  from book_chunks
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- Pocket Dating Coach app data
-- This schema keeps raw user intake separate from generated shareable profile output.

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  external_auth_id uuid unique,
  display_name text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists female_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete cascade,
  session_id text not null,
  display_name text,
  age_range text,
  city text,
  intent text,
  approved_for_matching boolean not null default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(session_id)
);

create table if not exists female_profile_photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references female_profiles(id) on delete cascade,
  client_id text,
  file_name text not null,
  storage_path text,
  preview_url text,
  story_role text not null check (story_role in ('lead', 'warmth', 'lifestyle', 'conversation', 'social')),
  note text not null default '',
  sort_order integer not null default 0,
  created_at timestamp with time zone default now()
);

create table if not exists female_profile_answers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references female_profiles(id) on delete cascade,
  client_id text,
  prompt text not null,
  answer text not null,
  category text not null check (category in ('self', 'photos', 'fantasy', 'boundaries', 'lifestyle')),
  sort_order integer not null default 0,
  created_at timestamp with time zone default now()
);

create table if not exists female_generated_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references female_profiles(id) on delete cascade,
  headline text not null,
  public_intro text not null,
  photo_story jsonb not null default '[]'::jsonb,
  what_she_values jsonb not null default '[]'::jsonb,
  conversation_hooks jsonb not null default '[]'::jsonb,
  private_match_brief text not null,
  compatibility_signals jsonb not null default '[]'::jsonb,
  preference_model jsonb not null default '{}'::jsonb,
  approved_for_matching boolean not null default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists female_profile_audit_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references female_profiles(id) on delete cascade,
  session_id text not null,
  event_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

create index if not exists female_profiles_session_idx on female_profiles(session_id);
create index if not exists female_profile_photos_profile_idx on female_profile_photos(profile_id);
create index if not exists female_profile_answers_profile_idx on female_profile_answers(profile_id);
create index if not exists female_generated_profiles_profile_idx on female_generated_profiles(profile_id);
create index if not exists female_profile_audit_events_profile_idx on female_profile_audit_events(profile_id);

-- Storage bucket for profile uploads. Public is false; use signed URLs in production.
insert into storage.buckets (id, name, public)
values ('profile-uploads', 'profile-uploads', false)
on conflict (id) do nothing;


-- ============================================================================
-- VERIFIED VIBE TABLES
-- ============================================================================

-- Users table
create table if not exists verified_vibe_users (
  id uuid primary key default gen_random_uuid(),
  gender text not null check (gender in ('man', 'woman', 'prefer_not_to_say')),
  archetype text not null,
  first_name text not null,
  age integer not null,
  city text not null,
  avatar_url text,
  about text,
  looking text,
  trust_score integer not null default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Verification records table
create table if not exists verified_vibe_verification (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references verified_vibe_users(id) on delete cascade,
  step text not null check (step in ('id', 'liveness', 'photos', 'spending_or_qa')),
  status text not null check (status in ('pending', 'completed', 'failed')),
  data jsonb,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- Likes table
create table if not exists verified_vibe_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references verified_vibe_users(id) on delete cascade,
  liked_user_id uuid not null references verified_vibe_users(id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique(user_id, liked_user_id)
);

-- Passes table
create table if not exists verified_vibe_passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references verified_vibe_users(id) on delete cascade,
  passed_user_id uuid not null references verified_vibe_users(id) on delete cascade,
  reason text not null default 'passed',
  created_at timestamp with time zone default now(),
  unique(user_id, passed_user_id)
);

-- Matches table
create table if not exists verified_vibe_matches (
  id uuid primary key default gen_random_uuid(),
  user1_id uuid not null references verified_vibe_users(id) on delete cascade,
  user2_id uuid not null references verified_vibe_users(id) on delete cascade,
  status text not null check (status in ('pending', 'mutual', 'rejected')) default 'pending',
  created_at timestamp with time zone default now()
);

-- Messages table
create table if not exists verified_vibe_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references verified_vibe_matches(id) on delete cascade,
  sender_id uuid not null references verified_vibe_users(id) on delete cascade,
  content text not null,
  created_at timestamp with time zone default now()
);

-- Typing indicators table (for realtime typing status)
create table if not exists verified_vibe_typing_indicators (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references verified_vibe_matches(id) on delete cascade,
  user_id uuid not null references verified_vibe_users(id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique(match_id, user_id)
);

-- Create indexes for better query performance
create index if not exists verified_vibe_users_gender_idx on verified_vibe_users(gender);
create index if not exists verified_vibe_users_archetype_idx on verified_vibe_users(archetype);
create index if not exists verified_vibe_verification_user_idx on verified_vibe_verification(user_id);
create index if not exists verified_vibe_verification_step_idx on verified_vibe_verification(step);
create index if not exists verified_vibe_likes_user_idx on verified_vibe_likes(user_id);
create index if not exists verified_vibe_likes_liked_user_idx on verified_vibe_likes(liked_user_id);
create index if not exists verified_vibe_passes_user_idx on verified_vibe_passes(user_id);
create index if not exists verified_vibe_passes_passed_user_idx on verified_vibe_passes(passed_user_id);
create index if not exists verified_vibe_matches_user1_idx on verified_vibe_matches(user1_id);
create index if not exists verified_vibe_matches_user2_idx on verified_vibe_matches(user2_id);
create index if not exists verified_vibe_matches_status_idx on verified_vibe_matches(status);
create index if not exists verified_vibe_messages_match_idx on verified_vibe_messages(match_id);
create index if not exists verified_vibe_messages_sender_idx on verified_vibe_messages(sender_id);
create index if not exists verified_vibe_messages_created_idx on verified_vibe_messages(created_at);
create index if not exists verified_vibe_typing_indicators_match_idx on verified_vibe_typing_indicators(match_id);
create index if not exists verified_vibe_typing_indicators_user_idx on verified_vibe_typing_indicators(user_id);

-- Enable realtime for messages and typing indicators
alter publication supabase_realtime add table verified_vibe_messages;
alter publication supabase_realtime add table verified_vibe_typing_indicators;
