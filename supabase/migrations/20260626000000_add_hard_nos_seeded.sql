-- Migration: add hard_nos_seeded guard to verified_vibe_users
--
-- Marks whether a user's hard_nos (dealbreakers) have had their one-time
-- onboarding seed applied. Once true, hard_nos is fully user-owned: the bio
-- editor is the live source of truth and refreshPoolEntry never re-seeds — so a
-- user who deliberately clears all their hard nos is not re-populated from
-- onboarding. A boolean (rather than "is the array empty?") is required to tell
-- "never seeded" apart from "seeded, then cleared".

ALTER TABLE verified_vibe_users
  ADD COLUMN IF NOT EXISTS hard_nos_seeded BOOLEAN NOT NULL DEFAULT false;
