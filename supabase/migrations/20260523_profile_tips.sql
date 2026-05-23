-- Migration: PDC-49 — Anonymous profile tips
-- Users can leave anonymous feedback on profiles they view in discover.
-- submitted_by_user_id is intentionally NOT stored — anonymity is a product guarantee.

CREATE TABLE IF NOT EXISTS profile_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  submitted_by_gender TEXT NOT NULL CHECK (submitted_by_gender IN ('man', 'woman', 'prefer_not_to_say')),
  tip_tags TEXT[] NOT NULL DEFAULT '{}',   -- e.g. ['handsome', 'trustworthy-vibes']
  tip_text TEXT,                            -- optional freetext, max 280 chars
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_tips_target ON profile_tips(target_user_id);

-- No RLS on reads from service role — AI assistants need aggregated access.
-- No user can query another user's individual tips; only aggregates are exposed via API.
ALTER TABLE profile_tips ENABLE ROW LEVEL SECURITY;

-- Only service role can write and read tips
CREATE POLICY "service_role_all_tips" ON profile_tips
  FOR ALL TO service_role USING (true);
