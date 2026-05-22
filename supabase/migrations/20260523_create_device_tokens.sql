-- ============================================================================
-- DEVICE TOKENS TABLE
-- Pocket Dating Coach - Push Notification Token Storage
-- ============================================================================
-- Stores FCM device tokens for push notification delivery.
-- Enforces one token per user per platform (android/ios).
-- RLS policies restrict all operations to the owning user.
--
-- Requirements: 5.1, 5.2, 5.7, 11.4

-- ============================================================================
-- CREATE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token varchar(256) NOT NULL,
  platform varchar(7) NOT NULL CHECK (platform IN ('android', 'ios')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enforce one token per user per platform
ALTER TABLE public.device_tokens
  ADD CONSTRAINT device_tokens_user_platform_unique UNIQUE (user_id, platform);

-- Index for fast lookups by user_id
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON public.device_tokens(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- Users can view their own device tokens
CREATE POLICY "Users can view own device tokens"
  ON public.device_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own device tokens
CREATE POLICY "Users can insert own device tokens"
  ON public.device_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own device tokens
CREATE POLICY "Users can update own device tokens"
  ON public.device_tokens
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own device tokens
CREATE POLICY "Users can delete own device tokens"
  ON public.device_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- END OF DEVICE TOKENS MIGRATION
-- ============================================================================
