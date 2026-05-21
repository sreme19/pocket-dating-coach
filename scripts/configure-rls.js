#!/usr/bin/env node

/**
 * RLS Configuration Script for Pocket Dating Coach
 * Executes all 6 SQL blocks to configure Row Level Security policies
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// SQL blocks for each table
const sqlBlocks = [
  {
    name: 'TABLE 1: verified_vibe_users',
    sql: `
      ALTER TABLE verified_vibe_users ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY "Users can view own profile"
        ON verified_vibe_users
        FOR SELECT
        USING (auth.uid() = id);
      
      CREATE POLICY "Users can update own profile"
        ON verified_vibe_users
        FOR UPDATE
        USING (auth.uid() = id);
      
      CREATE POLICY "Users can insert own profile"
        ON verified_vibe_users
        FOR INSERT
        WITH CHECK (auth.uid() = id);
    `
  },
  {
    name: 'TABLE 2: verified_vibe_verification',
    sql: `
      ALTER TABLE verified_vibe_verification ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY "Users can view own verification"
        ON verified_vibe_verification
        FOR SELECT
        USING (auth.uid() = user_id);
      
      CREATE POLICY "Users can update own verification"
        ON verified_vibe_verification
        FOR UPDATE
        USING (auth.uid() = user_id);
      
      CREATE POLICY "Users can insert own verification"
        ON verified_vibe_verification
        FOR INSERT
        WITH CHECK (auth.uid() = user_id);
    `
  },
  {
    name: 'TABLE 3: verified_vibe_matches',
    sql: `
      ALTER TABLE verified_vibe_matches ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY "Users can view own matches"
        ON verified_vibe_matches
        FOR SELECT
        USING (auth.uid() = user1_id OR auth.uid() = user2_id);
      
      CREATE POLICY "Users can update own matches"
        ON verified_vibe_matches
        FOR UPDATE
        USING (auth.uid() = user1_id OR auth.uid() = user2_id);
      
      CREATE POLICY "Users can create matches"
        ON verified_vibe_matches
        FOR INSERT
        WITH CHECK (auth.uid() = user1_id);
    `
  },
  {
    name: 'TABLE 4: verified_vibe_likes',
    sql: `
      ALTER TABLE verified_vibe_likes ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY "Users can view own likes"
        ON verified_vibe_likes
        FOR SELECT
        USING (auth.uid() = user_id);
      
      CREATE POLICY "Users can create likes"
        ON verified_vibe_likes
        FOR INSERT
        WITH CHECK (auth.uid() = user_id);
      
      CREATE POLICY "Users can delete own likes"
        ON verified_vibe_likes
        FOR DELETE
        USING (auth.uid() = user_id);
    `
  },
  {
    name: 'TABLE 5: verified_vibe_passes',
    sql: `
      ALTER TABLE verified_vibe_passes ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY "Users can view own passes"
        ON verified_vibe_passes
        FOR SELECT
        USING (auth.uid() = user_id);
      
      CREATE POLICY "Users can create passes"
        ON verified_vibe_passes
        FOR INSERT
        WITH CHECK (auth.uid() = user_id);
      
      CREATE POLICY "Users can delete own passes"
        ON verified_vibe_passes
        FOR DELETE
        USING (auth.uid() = user_id);
    `
  },
  {
    name: 'TABLE 6: verified_vibe_messages',
    sql: `
      ALTER TABLE verified_vibe_messages ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY "Users can view own messages"
        ON verified_vibe_messages
        FOR SELECT
        USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
      
      CREATE POLICY "Users can send messages"
        ON verified_vibe_messages
        FOR INSERT
        WITH CHECK (auth.uid() = sender_id);
    `
  }
];

async function executeRLSConfiguration() {
  console.log('🔐 Starting RLS Configuration for Pocket Dating Coach\n');
  console.log(`📍 Supabase URL: ${SUPABASE_URL}\n`);

  let successCount = 0;
  let failureCount = 0;

  for (const block of sqlBlocks) {
    try {
      console.log(`⏳ Executing: ${block.name}`);
      
      const { error } = await supabase.rpc('exec_sql', {
        sql: block.sql
      }).catch(async () => {
        // Fallback: try using the raw SQL endpoint
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'apikey': SUPABASE_SERVICE_KEY,
          },
          body: JSON.stringify({ sql: block.sql })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        
        return { error: null };
      });

      if (error) {
        console.log(`❌ Failed: ${block.name}`);
        console.log(`   Error: ${error.message}\n`);
        failureCount++;
      } else {
        console.log(`✅ Success: ${block.name}\n`);
        successCount++;
      }
    } catch (err) {
      console.log(`❌ Failed: ${block.name}`);
      console.log(`   Error: ${err.message}\n`);
      failureCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 RLS Configuration Summary');
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${successCount}/${sqlBlocks.length}`);
  console.log(`❌ Failed: ${failureCount}/${sqlBlocks.length}`);
  console.log('='.repeat(60) + '\n');

  if (failureCount === 0) {
    console.log('🎉 All RLS policies configured successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Go to Supabase Dashboard → Tables');
    console.log('2. For each table, click Security tab');
    console.log('3. Verify RLS is enabled with policies listed');
    console.log('4. Run verification tests in SQL Editor\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some policies failed to configure.');
    console.log('Please check the errors above and retry.\n');
    process.exit(1);
  }
}

executeRLSConfiguration();
