-- Allow users to delete their own verification rows.
-- This is needed so resetQAVerification() (called on lane change) can
-- delete the spending_or_qa step so the user re-fills Q&A for their new archetype.
CREATE POLICY "Users can delete own verification"
  ON verified_vibe_verification
  FOR DELETE
  USING (auth.uid() = user_id);
