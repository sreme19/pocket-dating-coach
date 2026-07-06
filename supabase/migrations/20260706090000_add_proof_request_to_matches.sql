-- In-chat proof collection (spec §3 Step 3): Bestie-driven proof requests.
--
-- One jsonb column holds the CURRENT proof request Bestie has open with the man
-- on this match, plus a compact history of past asks so she never re-asks a gap.
--
-- Shape:
-- {
--   "category":  "travel" | "lifestyle" | "discipline" | "social_proof" | "wealth" | "spending",
--   "status":    "pending" | "failed_attempt" | "refused" | "fulfilled",
--   "asked_at":  ISO timestamp,
--   "attempts":  int,                  -- failed upload attempts on this request
--   "resolved_at": ISO timestamp | null,
--   "history": [ { "category": ..., "outcome": "refused"|"fulfilled", "at": ISO } ]
-- }
--
-- Semantics (product decisions, 2026-07-06):
--   pending        → Bestie asked; the man's 📎 proof button is visible.
--   failed_attempt → he tried, verification failed; NOT a refusal — the request
--                    stays open and Bestie may warmly encourage a retry.
--   refused        → he declined/deflected; Bestie drops it and never re-asks.
--                    Kept as conversational context ONLY — it must never feed
--                    trust or match scoring.
--   fulfilled      → verified proof landed; Bestie acknowledges once, then clears.
ALTER TABLE verified_vibe_matches
  ADD COLUMN IF NOT EXISTS proof_request jsonb;

COMMENT ON COLUMN verified_vibe_matches.proof_request IS
  'Bestie-driven in-chat proof request state (category/status/attempts/history). Conversational context only — never used in trust or match scoring.';
