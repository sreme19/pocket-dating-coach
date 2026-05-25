-- ============================================================================
-- Security Advisor Fixes
-- Addresses critical RLS errors and function security warnings flagged by
-- Supabase Security Advisor (splinter linter).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RLS: verified_vibe_typing_indicators
--    Users should see indicators for matches they belong to, and only
--    insert/update/delete their own row.
-- ----------------------------------------------------------------------------

ALTER TABLE verified_vibe_typing_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view typing indicators for their matches"
  ON verified_vibe_typing_indicators FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM verified_vibe_matches
      WHERE id = match_id
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

-- ----------------------------------------------------------------------------
-- 2. RLS: book_chunks (pgvector knowledge-base table)
--    Publicly readable for semantic search; writes are service-role only.
-- ----------------------------------------------------------------------------

ALTER TABLE book_chunks ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user to run similarity searches
CREATE POLICY "Authenticated users can read book_chunks"
  ON book_chunks FOR SELECT
  TO authenticated
  USING (true);

-- Service role retains full write access via its bypass; no explicit INSERT
-- policy needed for app users.

-- ----------------------------------------------------------------------------
-- 3. Function search_path hardening
--    Prevents search_path injection on functions exposed to PostgREST.
-- ----------------------------------------------------------------------------

-- update_vv_updated_at: timestamp trigger helper
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

-- match_book_chunks: pgvector similarity search
-- Re-declare with fixed search_path; keep existing signature intact.
-- NOTE: If this function was created with a different signature in Supabase,
-- update the parameter types to match before running.
CREATE OR REPLACE FUNCTION match_book_chunks(
  query_embedding vector,
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bc.id,
    bc.content,
    1 - (bc.embedding <=> query_embedding) AS similarity
  FROM book_chunks bc
  WHERE 1 - (bc.embedding <=> query_embedding) > match_threshold
  ORDER BY bc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. mark_profile_section_stale: restrict direct execution
--    This function is only meant to be called by its trigger, not by users.
-- ----------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION mark_profile_section_stale() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION mark_profile_section_stale() FROM authenticated;

-- Harden search_path on the function as well
CREATE OR REPLACE FUNCTION mark_profile_section_stale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE verified_vibe_users
  SET profile_section_stale = true
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

-- Re-apply execute restriction after OR REPLACE (OR REPLACE resets grants)
REVOKE EXECUTE ON FUNCTION mark_profile_section_stale() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION mark_profile_section_stale() FROM authenticated;
