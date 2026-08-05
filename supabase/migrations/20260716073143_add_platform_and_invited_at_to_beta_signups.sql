ALTER TABLE verified_vibe_beta_signups
ADD COLUMN IF NOT EXISTS platform text CHECK (platform IN ('ios', 'android'));

ALTER TABLE verified_vibe_beta_signups
ADD COLUMN IF NOT EXISTS invited_at timestamptz;;
