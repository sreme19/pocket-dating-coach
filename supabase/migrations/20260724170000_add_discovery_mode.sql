-- Networking Season — per-user discovery mode.
--
-- 'date'       (default): classic dating. Sees opposite gender only.
-- 'networking': an emotional-season pause on romance. Still sees opposite gender,
--               and ADDITIONALLY sees same-gender users who are also 'networking'.
--               The AI companion (Bestie/Wingman) keeps such threads platonic.
--
-- The mode is a per-user "season" flag, NOT a matching-engine rewrite. See
-- docs/requirements/Networking_Mode_Design.md.
--
-- Run by hand in the Supabase SQL editor (no exec_sql RPC). Idempotent.

ALTER TABLE verified_vibe_users
  ADD COLUMN IF NOT EXISTS discovery_mode TEXT NOT NULL DEFAULT 'date';

-- vv_pool_profiles mirrors user fields for the matcher/discovery projection.
ALTER TABLE vv_pool_profiles
  ADD COLUMN IF NOT EXISTS discovery_mode TEXT NOT NULL DEFAULT 'date';

-- CHECK constraints added separately so re-runs don't fail on an existing constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'verified_vibe_users_discovery_mode_check'
  ) THEN
    ALTER TABLE verified_vibe_users
      ADD CONSTRAINT verified_vibe_users_discovery_mode_check
      CHECK (discovery_mode IN ('date', 'networking'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vv_pool_profiles_discovery_mode_check'
  ) THEN
    ALTER TABLE vv_pool_profiles
      ADD CONSTRAINT vv_pool_profiles_discovery_mode_check
      CHECK (discovery_mode IN ('date', 'networking'));
  END IF;
END $$;

COMMENT ON COLUMN verified_vibe_users.discovery_mode IS
  'Networking Season flag: date (default) | networking. Networking additionally surfaces same-gender networkers and keeps AI threads platonic.';

-- Same-gender networking discovery filters on this column in vv_pool_profiles.
CREATE INDEX IF NOT EXISTS idx_vv_pool_profiles_discovery_mode
  ON vv_pool_profiles (discovery_mode);
