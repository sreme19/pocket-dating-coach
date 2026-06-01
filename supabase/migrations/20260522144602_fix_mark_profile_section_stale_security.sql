REVOKE EXECUTE ON FUNCTION public.mark_profile_section_stale() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION mark_profile_section_stale() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE verified_vibe_users SET profile_section_stale = true WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;;
