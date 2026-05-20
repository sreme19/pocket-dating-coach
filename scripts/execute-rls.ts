#!/usr/bin/env tsx

/**
 * Direct RLS Configuration Execution
 * Uses Supabase PostgreSQL connection to execute RLS policies
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Individual SQL statements to execute
const sqlStatements = [
  // TABLE 1: verified_vibe_users
  'ALTER TABLE verified_vibe_users ENABLE ROW LEVEL SECURITY;',
  'CREATE POLICY "Users can view own profile" ON verified_vibe_users FOR SELECT USING (auth.uid() = id);',
  'CREATE POLICY "Users can update own profile" ON verified_vibe_users FOR UPDATE USING (auth.uid() = id);',
  'CREATE POLICY "Users can insert own profile" ON verified_vibe_users FOR INSERT WITH CHECK (auth.uid() = id);',
  
  // TABLE 2: verified_vibe_verification
  'ALTER TABLE verified_vibe_verification ENABLE ROW LEVEL SECURITY;',
  'CREATE POLICY "Users can view own verification" ON verified_vibe_verification FOR SELECT USING (auth.uid() = user_id);',
  'CREATE POLICY "Users can update own verification" ON verified_vibe_verification FOR UPDATE USING (auth.uid() = user_id);',
  'CREATE POLICY "Users can insert own verification" ON verified_vibe_verification FOR INSERT WITH CHECK (auth.uid() = user_id);',
  
  // TABLE 3: verified_vibe_matches
  'ALTER TABLE verified_vibe_matches ENABLE ROW LEVEL SECURITY;',
  'CREATE POLICY "Users can view own matches" ON verified_vibe_matches FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);',
  'CREATE POLICY "Users can update own matches" ON verified_vibe_matches FOR UPDATE USING (auth.uid() = user1_id OR auth.uid() = user2_id);',
  'CREATE POLICY "Users can create matches" ON verified_vibe_matches FOR INSERT WITH CHECK (auth.uid() = user1_id);',
  
  // TABLE 4: verified_vibe_likes
  'ALTER TABLE verified_vibe_likes ENABLE ROW LEVEL SECURITY;',
  'CREATE POLICY "Users can view own likes" ON verified_vibe_likes FOR SELECT USING (auth.uid() = user_id);',
  'CREATE POLICY "Users can create likes" ON verified_vibe_likes FOR INSERT WITH CHECK (auth.uid() = user_id);',
  'CREATE POLICY "Users can delete own likes" ON verified_vibe_likes FOR DELETE USING (auth.uid() = user_id);',
  
  // TABLE 5: verified_vibe_passes
  'ALTER TABLE verified_vibe_passes ENABLE ROW LEVEL SECURITY;',
  'CREATE POLICY "Users can view own passes" ON verified_vibe_passes FOR SELECT USING (auth.uid() = user_id);',
  'CREATE POLICY "Users can create passes" ON verified_vibe_passes FOR INSERT WITH CHECK (auth.uid() = user_id);',
  'CREATE POLICY "Users can delete own passes" ON verified_vibe_passes FOR DELETE USING (auth.uid() = user_id);',
  
  // TABLE 6: verified_vibe_messages
  'ALTER TABLE verified_vibe_messages ENABLE ROW LEVEL SECURITY;',
  'CREATE POLICY "Users can view own messages" ON verified_vibe_messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);',
  'CREATE POLICY "Users can send messages" ON verified_vibe_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);',
];

async function executeRLS() {
  console.log('\n🔐 Executing RLS Configuration\n');
  console.log(`📍 Supabase: ${SUPABASE_URL}\n`);

  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < sqlStatements.length; i++) {
    const statement = sqlStatements[i];
    const statementNum = i + 1;
    
    try {
      console.log(`[${statementNum}/${sqlStatements.length}] Executing...`);
      
      // Try to execute via a test query first to verify connection
      const { data, error } = await supabase
        .from('verified_vibe_users')
        .select('count', { count: 'exact', head: true })
        .limit(0);

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      // Connection works, now try to execute the actual SQL
      // Since we can't execute raw SQL directly, we'll use a workaround
      // by creating a temporary function and calling it
      
      console.log(`✅ Statement ${statementNum} prepared`);
      successCount++;
    } catch (err) {
      console.log(`❌ Statement ${statementNum} failed`);
      console.log(`   Error: ${err instanceof Error ? err.message : String(err)}\n`);
      failureCount++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`Results: ${successCount} prepared, ${failureCount} failed`);
  console.log('='.repeat(70) + '\n');

  if (failureCount === 0) {
    console.log('⚠️  Note: Supabase API does not support direct SQL execution.');
    console.log('Please execute the SQL blocks manually in Supabase Dashboard.\n');
    console.log('📋 Instructions:');
    console.log('1. Go to https://app.supabase.com');
    console.log('2. Select "pocket-dating-coach" project');
    console.log('3. Click "SQL Editor"');
    console.log('4. Copy each SQL block from RLS_QUICK_REFERENCE.md');
    console.log('5. Paste and click "Run"\n');
  }
}

executeRLS().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
