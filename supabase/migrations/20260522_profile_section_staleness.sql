-- Migration: Profile section staleness trigger
-- Purpose: When ai_assistant_profiles is updated, mark the user's profile
--          section as stale so the app knows to regenerate the display.

-- 1. Add staleness flag to verified_vibe_users
ALTER TABLE verified_vibe_users
  ADD COLUMN IF NOT EXISTS profile_section_stale boolean DEFAULT false;

-- 2. Trigger function — sets flag on the owning user when their profile data changes
CREATE OR REPLACE FUNCTION mark_profile_section_stale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE verified_vibe_users
  SET profile_section_stale = true
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

-- 3. Trigger fires after insert or update of ai_assistant_profiles
DROP TRIGGER IF EXISTS trg_profile_section_staleness ON ai_assistant_profiles;

CREATE TRIGGER trg_profile_section_staleness
  AFTER INSERT OR UPDATE OF data
  ON ai_assistant_profiles
  FOR EACH ROW
  EXECUTE FUNCTION mark_profile_section_stale();
