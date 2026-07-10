-- Soft-delete for matches (2026-07-09). Matchmaker/match history must be PRESERVED
-- for analytics, so unmatching/blocking no longer DELETES the row (which also
-- cascade-deleted its messages). Instead the match is marked with a terminal
-- status and kept.
--
-- Existing status enum: 'pending' | 'mutual' | 'rejected'  (in practice every live
-- match is 'mutual'; 'pending'/'rejected' are unused legacy values). We add:
--   'unmatched' → user unmatched. The pair CAN resurface in Discover again.
--   'blocked'   → user blocked. Stays hidden until unblock — hiding is enforced by
--                 verified_vibe_passes (reason 'blocked'/'blocked_reverse'), not by
--                 this status; the status is the terminal marker + analytics signal.
--
-- Reads that list active matches already filter status='mutual', so they exclude
-- both new terminal states for free.
ALTER TABLE verified_vibe_matches
  DROP CONSTRAINT IF EXISTS verified_vibe_matches_status_check;

ALTER TABLE verified_vibe_matches
  ADD CONSTRAINT verified_vibe_matches_status_check
  CHECK (status IN ('pending', 'mutual', 'rejected', 'unmatched', 'blocked'));
