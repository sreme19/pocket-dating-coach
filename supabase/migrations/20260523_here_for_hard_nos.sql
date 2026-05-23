-- Migration: add here_for_title, here_for_desc, hard_nos to verified_vibe_users
-- Lets male profiles store their "Here For" and "Hard Nos" directly in the DB
-- rather than deriving from personality.md

ALTER TABLE verified_vibe_users
  ADD COLUMN IF NOT EXISTS here_for_title TEXT,
  ADD COLUMN IF NOT EXISTS here_for_desc  TEXT,
  ADD COLUMN IF NOT EXISTS hard_nos       JSONB DEFAULT '[]'::jsonb;
