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
