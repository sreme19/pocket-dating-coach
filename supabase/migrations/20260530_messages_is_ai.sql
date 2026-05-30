-- Mark messages sent by AI Bestie so both sides can style them differently.
ALTER TABLE verified_vibe_messages
  ADD COLUMN IF NOT EXISTS is_ai BOOLEAN NOT NULL DEFAULT FALSE;
