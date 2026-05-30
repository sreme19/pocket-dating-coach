-- AI Bestie coaching card data, attached to the message that triggered it.
-- ai_signal: '✅' | '⚠️' | '🚩'   ai_read: private one-liner for the female user.
ALTER TABLE verified_vibe_messages
  ADD COLUMN IF NOT EXISTS ai_signal TEXT,
  ADD COLUMN IF NOT EXISTS ai_read   TEXT;
