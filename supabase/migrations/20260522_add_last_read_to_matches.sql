-- Track when each participant last read a conversation.
-- Used to calculate unread message counts in the chat list.
--
-- user1_last_read_at / user2_last_read_at default to NOW() so that
-- existing matches don't flood with fake unread counts on first deploy.

ALTER TABLE verified_vibe_matches
  ADD COLUMN IF NOT EXISTS user1_last_read_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS user2_last_read_at TIMESTAMPTZ DEFAULT NOW();
