-- Allow 'deleted' as a vv_pool_profiles.availability_status.
--
-- Soft-delete (delete-user.ts) drops a user from the live pool by setting
-- availability_status = 'deleted'. The matcher only ever considers rows with
-- status = 'active', and the pool table has no deleted_at column, so this pool
-- status is the ONLY thing that keeps a soft-deleted user out of matching.
--
-- The original CHECK only permitted ('active','paused'), so the soft-delete
-- write silently failed the constraint and left deleted users matchable. Extend
-- the constraint to include 'deleted'.
--
-- The original constraint was defined inline (unnamed), so we drop whichever
-- CHECK constraint references availability_status rather than guessing its name.
DO $$
DECLARE cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'vv_pool_profiles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%availability_status%';

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE vv_pool_profiles DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE vv_pool_profiles
ADD CONSTRAINT vv_pool_profiles_availability_status_check
CHECK (availability_status IN ('active', 'paused', 'deleted'));;
