-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES CONFIGURATION
-- Pocket Dating Coach - verified-vibe Database
-- ============================================================================
-- This script configures RLS policies to ensure users can only access their own data
-- Execute all blocks in order. Each block must complete before moving to the next.

-- ============================================================================
-- TABLE 1: verified_vibe_users
-- Purpose: User profiles with gender, archetype, bio, etc.
-- ============================================================================

ALTER TABLE verified_vibe_users ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON verified_vibe_users
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON verified_vibe_users
  FOR UPDATE
  USING (auth.uid() = id);

-- Users can create their own profile (signups)
CREATE POLICY "Users can insert own profile"
  ON verified_vibe_users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- TABLE 2: verified_vibe_verification
-- Purpose: ID verification, liveness, photos, spending/Q&A steps
-- ============================================================================

ALTER TABLE verified_vibe_verification ENABLE ROW LEVEL SECURITY;

-- Users can view their own verification steps
CREATE POLICY "Users can view own verification"
  ON verified_vibe_verification
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own verification
CREATE POLICY "Users can update own verification"
  ON verified_vibe_verification
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can insert their own verification records
CREATE POLICY "Users can insert own verification"
  ON verified_vibe_verification
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- TABLE 3: verified_vibe_matches
-- Purpose: When two users match (both liked each other)
-- ============================================================================

ALTER TABLE verified_vibe_matches ENABLE ROW LEVEL SECURITY;

-- Users can view matches they're part of (as user1 or user2)
CREATE POLICY "Users can view own matches"
  ON verified_vibe_matches
  FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Users can update matches they're part of
CREATE POLICY "Users can update own matches"
  ON verified_vibe_matches
  FOR UPDATE
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Users can create matches when they like someone
CREATE POLICY "Users can create matches"
  ON verified_vibe_matches
  FOR INSERT
  WITH CHECK (auth.uid() = user1_id);

-- ============================================================================
-- TABLE 4: verified_vibe_likes
-- Purpose: User's "like" history when swiping on profiles
-- ============================================================================

ALTER TABLE verified_vibe_likes ENABLE ROW LEVEL SECURITY;

-- Users can view their own likes
CREATE POLICY "Users can view own likes"
  ON verified_vibe_likes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create likes when swiping
CREATE POLICY "Users can create likes"
  ON verified_vibe_likes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own likes (to undo)
CREATE POLICY "Users can delete own likes"
  ON verified_vibe_likes
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- TABLE 5: verified_vibe_passes
-- Purpose: User's "pass" history when swiping on profiles
-- ============================================================================

ALTER TABLE verified_vibe_passes ENABLE ROW LEVEL SECURITY;

-- Users can view their own passes
CREATE POLICY "Users can view own passes"
  ON verified_vibe_passes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create passes when swiping
CREATE POLICY "Users can create passes"
  ON verified_vibe_passes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own passes
CREATE POLICY "Users can delete own passes"
  ON verified_vibe_passes
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- TABLE 6: verified_vibe_messages
-- Purpose: Direct messages between matched users
-- ============================================================================

ALTER TABLE verified_vibe_messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages they're part of (sender or recipient)
CREATE POLICY "Users can view own messages"
  ON verified_vibe_messages
  FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Users can send messages
CREATE POLICY "Users can send messages"
  ON verified_vibe_messages
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- ============================================================================
-- VERIFICATION TESTS
-- Run these after policies are active to verify they work correctly
-- ============================================================================

-- Test 1: Authenticated user can see their own profile
-- This should return the user's profile (not empty)
-- SELECT * FROM verified_vibe_users WHERE id = auth.uid();

-- Test 2: User CANNOT see other users' profiles
-- This should return ZERO rows (blocked by RLS)
-- SELECT * FROM verified_vibe_users WHERE id != auth.uid();

-- Test 3: Verification data is isolated
-- Returns only this user's verification steps
-- SELECT * FROM verified_vibe_verification WHERE user_id = auth.uid();

-- ============================================================================
-- END OF RLS CONFIGURATION
-- ============================================================================
