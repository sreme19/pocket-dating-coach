-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES CONFIGURATION
-- Pocket Dating Coach - verified-vibe Database
-- ============================================================================

-- TABLE 1: verified_vibe_users
ALTER TABLE verified_vibe_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON verified_vibe_users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON verified_vibe_users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON verified_vibe_users FOR INSERT WITH CHECK (auth.uid() = id);

-- TABLE 2: verified_vibe_verification
ALTER TABLE verified_vibe_verification ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own verification" ON verified_vibe_verification FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own verification" ON verified_vibe_verification FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own verification" ON verified_vibe_verification FOR INSERT WITH CHECK (auth.uid() = user_id);

-- TABLE 3: verified_vibe_matches
ALTER TABLE verified_vibe_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own matches" ON verified_vibe_matches FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Users can update own matches" ON verified_vibe_matches FOR UPDATE USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Users can create matches" ON verified_vibe_matches FOR INSERT WITH CHECK (auth.uid() = user1_id);

-- TABLE 4: verified_vibe_likes
ALTER TABLE verified_vibe_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own likes" ON verified_vibe_likes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create likes" ON verified_vibe_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own likes" ON verified_vibe_likes FOR DELETE USING (auth.uid() = user_id);

-- TABLE 5: verified_vibe_passes
ALTER TABLE verified_vibe_passes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own passes" ON verified_vibe_passes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create passes" ON verified_vibe_passes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own passes" ON verified_vibe_passes FOR DELETE USING (auth.uid() = user_id);

-- TABLE 6: verified_vibe_messages
ALTER TABLE verified_vibe_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own messages" ON verified_vibe_messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Users can send messages" ON verified_vibe_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
