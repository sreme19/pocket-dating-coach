ALTER TABLE verified_vibe_referral_links
  ALTER COLUMN referrer_id DROP NOT NULL;

ALTER TABLE verified_vibe_referral_links
  ADD COLUMN kind text CHECK (kind IN ('admin_invite_women', 'admin_invite_men'));

CREATE UNIQUE INDEX verified_vibe_referral_links_kind_key
  ON verified_vibe_referral_links (kind)
  WHERE kind IS NOT NULL;

ALTER TABLE verified_vibe_beta_signups
  ALTER COLUMN referrer_id DROP NOT NULL;;
