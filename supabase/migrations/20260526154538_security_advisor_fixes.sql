-- Typing indicators RLS
ALTER TABLE verified_vibe_typing_indicators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view typing indicators for their matches" ON verified_vibe_typing_indicators;
CREATE POLICY "Users can view typing indicators for their matches"
ON verified_vibe_typing_indicators FOR SELECT
USING (EXISTS (
  SELECT 1 FROM verified_vibe_matches
  WHERE id = match_id
  AND (user1_id = auth.uid() OR user2_id = auth.uid())
));

DROP POLICY IF EXISTS "Users can insert own typing indicator" ON verified_vibe_typing_indicators;
CREATE POLICY "Users can insert own typing indicator"
ON verified_vibe_typing_indicators FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own typing indicator" ON verified_vibe_typing_indicators;
CREATE POLICY "Users can update own typing indicator"
ON verified_vibe_typing_indicators FOR UPDATE
USING  (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own typing indicator" ON verified_vibe_typing_indicators;
CREATE POLICY "Users can delete own typing indicator"
ON verified_vibe_typing_indicators FOR DELETE
USING (auth.uid() = user_id);

-- book_chunks RLS (pgvector knowledge base)
ALTER TABLE book_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read book_chunks" ON book_chunks;
CREATE POLICY "Authenticated users can read book_chunks"
ON book_chunks FOR SELECT TO authenticated USING (true);

-- Harden timestamp trigger function
CREATE OR REPLACE FUNCTION update_vv_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;;
