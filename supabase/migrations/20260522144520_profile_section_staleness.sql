ALTER TABLE verified_vibe_users ADD COLUMN IF NOT EXISTS profile_section_stale BOOLEAN DEFAULT FALSE;

CREATE OR REPLACE FUNCTION mark_profile_section_stale() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE verified_vibe_users SET profile_section_stale = true WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_section_staleness ON ai_assistant_profiles;
CREATE TRIGGER trg_profile_section_staleness
  AFTER INSERT OR UPDATE OF data ON ai_assistant_profiles
  FOR EACH ROW EXECUTE FUNCTION mark_profile_section_stale();;
