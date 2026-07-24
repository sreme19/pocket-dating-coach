-- Networking Season — Phase 4 (enforcement). Additive + idempotent.
-- Run by hand in the Supabase SQL editor (no exec_sql RPC).
-- All reads of these columns are gated behind NETWORKING_ENFORCEMENT_GATE in code,
-- so this migration can be applied before or after the deploy without breaking anything.

-- Mechanic 1 — de-rank persistent romantic pushers in the woman's inbox (local only).
ALTER TABLE verified_vibe_matches
  ADD COLUMN IF NOT EXISTS networking_pressure_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deranked_at timestamptz;

COMMENT ON COLUMN verified_vibe_matches.networking_pressure_count IS
  'Networking Season: times the man kept pushing romance after being told she is networking. Sinks him in HER inbox only; never affects his global trust/standing.';

-- Mechanic 3 — switch-back nudge cadence + permanent opt-out (per user).
ALTER TABLE verified_vibe_users
  ADD COLUMN IF NOT EXISTS season_nudge_last_at timestamptz,
  ADD COLUMN IF NOT EXISTS season_nudge_opted_out boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN verified_vibe_users.season_nudge_last_at IS
  'Networking Season: last time the AI reminded them they can switch back to Date (cadence cap ~14d).';
