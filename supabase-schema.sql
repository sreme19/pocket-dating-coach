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
