-- Add reason column to verified_vibe_passes so block entries can be
-- distinguished from regular swipe-left passes.
-- Values: 'passed' (swipe left), 'blocked' (block), 'blocked_reverse' (bidirectional block)

ALTER TABLE verified_vibe_passes
  ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT 'passed';

-- Index for the blocked-users query (.eq('reason', 'blocked'))
CREATE INDEX IF NOT EXISTS idx_verified_vibe_passes_reason
  ON verified_vibe_passes(user_id, reason);
