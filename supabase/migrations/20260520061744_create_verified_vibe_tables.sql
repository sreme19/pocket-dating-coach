-- Migration: Create missing Verified Vibe tables
-- Run this in your Supabase SQL editor to deploy the schema for seed profiles

-- Verified Vibe Users table
CREATE TABLE IF NOT EXISTS verified_vibe_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gender TEXT NOT NULL CHECK (gender IN ('man', 'woman', 'prefer_not_to_say')),
  archetype TEXT NOT NULL,
  first_name TEXT NOT NULL,
  age INTEGER NOT NULL,
  city TEXT NOT NULL,
  avatar_url TEXT,
  about TEXT,
  looking TEXT,
  trust_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Verification records table
CREATE TABLE IF NOT EXISTS verified_vibe_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  step TEXT NOT NULL CHECK (step IN ('id', 'liveness', 'photos', 'spending_or_qa')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  data JSONB,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Likes table
CREATE TABLE IF NOT EXISTS verified_vibe_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  liked_user_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, liked_user_id)
);

-- Passes table
CREATE TABLE IF NOT EXISTS verified_vibe_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  passed_user_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, passed_user_id)
);

-- Matches table
CREATE TABLE IF NOT EXISTS verified_vibe_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'mutual', 'rejected')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS verified_vibe_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES verified_vibe_matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Typing indicators table (for realtime typing status)
CREATE TABLE IF NOT EXISTS verified_vibe_typing_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES verified_vibe_matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(match_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_verified_vibe_users_gender ON verified_vibe_users(gender);
CREATE INDEX IF NOT EXISTS idx_verified_vibe_users_archetype ON verified_vibe_users(archetype);
CREATE INDEX IF NOT EXISTS idx_verified_vibe_verification_user_id ON verified_vibe_verification(user_id);
CREATE INDEX IF NOT EXISTS idx_verified_vibe_verification_step ON verified_vibe_verification(step);
CREATE INDEX IF NOT EXISTS idx_verified_vibe_likes_user_id ON verified_vibe_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_verified_vibe_likes_liked_user_id ON verified_vibe_likes(liked_user_id);
CREATE INDEX IF NOT EXISTS idx_verified_vibe_passes_user_id ON verified_vibe_passes(user_id);
CREATE INDEX IF NOT EXISTS idx_verified_vibe_passes_passed_user_id ON verified_vibe_passes(passed_user_id);
CREATE INDEX IF NOT EXISTS idx_verified_vibe_matches_user1_id ON verified_vibe_matches(user1_id);
CREATE INDEX IF NOT EXISTS idx_verified_vibe_matches_user2_id ON verified_vibe_matches(user2_id);
CREATE INDEX IF NOT EXISTS idx_verified_vibe_matches_status ON verified_vibe_matches(status);
CREATE INDEX IF NOT EXISTS idx_verified_vibe_messages_match_id ON verified_vibe_messages(match_id);
CREATE INDEX IF NOT EXISTS idx_verified_vibe_messages_sender_id ON verified_vibe_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_verified_vibe_typing_indicators_match_id ON verified_vibe_typing_indicators(match_id);

-- Enable realtime for messages and typing indicators
ALTER PUBLICATION supabase_realtime ADD TABLE verified_vibe_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE verified_vibe_typing_indicators;;
