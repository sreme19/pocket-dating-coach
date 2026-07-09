-- AI Bestie CHECKLIST (spec §D "gap analysis first" + §F "path planning, wrap-up").
--
-- One jsonb column holds the checklist Bestie computed for THIS man on THIS match:
-- the specific things she needs to learn about him before handing off to the
-- woman, how many are done, and whether she has wrapped up. This replaces the old
-- hard-coded "5 messages then she joins" counter with a per-man, checklist-derived
-- number that Bestie herself decides.
--
-- Shape:
-- {
--   "items": [
--     { "id": "kebab-slug", "label": "short human label", "status": "open"|"done",
--       "done_at": ISO timestamp | null }
--   ],
--   "status":     "active" | "wrapped",   -- wrapped = all items done / Bestie's judgment
--   "created_at": ISO timestamp,
--   "wrapped_at": ISO timestamp | null
-- }
--
-- Semantics (product decisions, 2026-07-09):
--   active  → Bestie is still working through the checklist. The man's progress
--             counter shows done/total from it.
--   wrapped → Bestie judged the items sufficiently answered (§F). The man's chat is
--             FROZEN (Option A) until the woman replies; she is notified to step in.
--
-- Conversational/UX state ONLY — like proof_request it must never feed trust or
-- match scoring.
ALTER TABLE verified_vibe_matches
  ADD COLUMN IF NOT EXISTS bestie_checklist jsonb;

COMMENT ON COLUMN verified_vibe_matches.bestie_checklist IS
  'AI Bestie per-man checklist (items/status/wrapped_at). Drives the man''s "she joins in" progress + wrap-up hand-off. Conversational/UX state only — never used in trust or match scoring.';
