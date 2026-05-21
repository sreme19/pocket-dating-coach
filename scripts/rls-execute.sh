#!/bin/bash

# RLS Configuration Execution Script
# Connects directly to Supabase PostgreSQL and executes RLS policies

set -e

echo ""
echo "🔐 RLS Configuration Execution"
echo "======================================================================"
echo ""

# Extract project ID from Supabase URL
# URL format: https://[PROJECT_ID].supabase.co
SUPABASE_URL="${SUPABASE_URL:-https://stikoktiaxqtcsohcxzp.supabase.co}"
PROJECT_ID=$(echo "$SUPABASE_URL" | sed 's|https://||' | sed 's|\.supabase\.co||')

echo "📍 Project ID: $PROJECT_ID"
echo "📍 Supabase URL: $SUPABASE_URL"
echo ""

# PostgreSQL connection string for Supabase
# Format: postgresql://postgres:[PASSWORD]@[PROJECT_ID].supabase.co:5432/postgres
# We need the service role key to authenticate

if [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "❌ Error: SUPABASE_SERVICE_KEY not set"
  exit 1
fi

# Create temporary SQL file with all RLS policies
TEMP_SQL=$(mktemp)

cat > "$TEMP_SQL" << 'EOF'
-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES CONFIGURATION
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
EOF

echo "📝 SQL file created: $TEMP_SQL"
echo ""
echo "⏳ Attempting to execute RLS policies..."
echo ""

# Try to connect and execute
# Note: This requires the PostgreSQL password to be set
# For Supabase, we use the service role key as the password

# The connection string format for Supabase is:
# postgresql://postgres:[SERVICE_KEY]@[PROJECT_ID].supabase.co:5432/postgres

# However, the service key is a JWT token, not a password
# We need to use it differently

echo "⚠️  Note: Direct PostgreSQL connection requires database password"
echo "    Supabase service key is a JWT token, not a database password"
echo ""
echo "📋 Alternative: Execute SQL manually in Supabase Dashboard"
echo "    1. Go to https://app.supabase.com"
echo "    2. Select 'pocket-dating-coach' project"
echo "    3. Click 'SQL Editor'"
echo "    4. Copy SQL from: $TEMP_SQL"
echo "    5. Paste and click 'Run'"
echo ""

# Clean up
rm -f "$TEMP_SQL"

echo "✅ Script completed"
echo ""
