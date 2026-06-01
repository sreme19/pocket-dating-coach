-- 1. RLS: verified_vibe_typing_indicators
ALTER TABLE verified_vibe_typing_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view typing indicators for their matches"
  ON verified_vibe_typing_indicators FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM verified_vibe_matches
      WHERE id = verified_vibe_typing_indicators.match_id
        AND (user1_id = auth.uid() OR user2_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert own typing indicator"
  ON verified_vibe_typing_indicators FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own typing indicator"
  ON verified_vibe_typing_indicators FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own typing indicator"
  ON verified_vibe_typing_indicators FOR DELETE
  USING (auth.uid() = user_id);

-- 2. RLS: book_chunks
ALTER TABLE book_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read book_chunks"
  ON book_chunks FOR SELECT
  TO authenticated
  USING (true);

-- 3. Harden update_vv_updated_at search_path
CREATE OR REPLACE FUNCTION update_vv_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 4. Harden match_book_chunks search_path (matching actual production signature)
CREATE OR REPLACE FUNCTION match_book_chunks(query_embedding vector, match_count integer DEFAULT 5)
RETURNS TABLE (id bigint, content text, chapter text, similarity double precision)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  select
    book_chunks.id,
    book_chunks.content,
    book_chunks.chapter,
    1 - (book_chunks.embedding <=> query_embedding) as similarity
  from book_chunks
  order by book_chunks.embedding <=> query_embedding
  limit match_count;
$$;

-- 5. Revoke direct EXECUTE on mark_profile_section_stale (trigger-only)
REVOKE EXECUTE ON FUNCTION mark_profile_section_stale() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION mark_profile_section_stale() FROM authenticated;;
