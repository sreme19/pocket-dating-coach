ALTER TABLE verified_vibe_users
ADD COLUMN IF NOT EXISTS here_for_title TEXT,
ADD COLUMN IF NOT EXISTS here_for_desc  TEXT,
ADD COLUMN IF NOT EXISTS hard_nos       JSONB DEFAULT '[]'::jsonb;;
