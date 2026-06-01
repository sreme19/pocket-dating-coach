-- Add unique constraint for verification steps to support ON CONFLICT
ALTER TABLE verified_vibe_verification
ADD CONSTRAINT unique_user_step UNIQUE (user_id, step);;
