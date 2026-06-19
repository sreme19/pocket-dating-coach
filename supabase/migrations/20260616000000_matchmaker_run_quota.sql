-- On-demand Matchmaker quota
--
-- Adds a per-user lifetime quota for the "Find Matches" button on the chat page.
-- Each press of the button consumes one run (regardless of whether a match is
-- found). `matchmaker_runs_limit` defaults to 3 and is intended to be raised
-- later when a user buys more matches.

ALTER TABLE verified_vibe_users
  ADD COLUMN IF NOT EXISTS matchmaker_runs_used  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS matchmaker_runs_limit INTEGER NOT NULL DEFAULT 3;
