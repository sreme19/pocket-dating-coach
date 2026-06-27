-- Migration: NULL-sentinel for hard_nos seeding
--
-- hard_nos is the single source of truth for dealbreakers. We need to tell apart
-- "never seeded" from "deliberately cleared" without a separate flag column:
--   NULL  → never seeded  → refreshPoolEntry seeds it from onboarding once
--   []    → user cleared  → respected, left empty (no re-seed)
--   [...] → user-owned    → used verbatim
--
-- Existing rows default to '[]'. None of them are "deliberately cleared" (clearing
-- wasn't persistable before this change), so reset empty arrays to NULL — they will
-- get their one-time onboarding seed on the next refresh. Then drop the '[]' default
-- so new rows start as NULL (unseeded).

UPDATE verified_vibe_users SET hard_nos = NULL WHERE hard_nos = '[]'::jsonb;

ALTER TABLE verified_vibe_users ALTER COLUMN hard_nos DROP DEFAULT;
