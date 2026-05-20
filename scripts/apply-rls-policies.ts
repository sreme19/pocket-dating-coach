#!/usr/bin/env tsx

/**
 * Apply RLS Policies to Supabase Database
 * Executes all 6 SQL blocks to configure Row Level Security
 * 
 * Usage: npm run apply:rls
 * or: tsx --env-file=.env.local scripts/apply-rls-policies.ts
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

async function applyRLSPolicies() {
  console.log('\n🔐 Applying RLS Policies to Supabase Database\n');
  console.log(`📍 Supabase URL: ${SUPABASE_URL}\n`);
  console.log('='.repeat(70));

  let successCount = 0;
  let failureCount = 0;
  const results: Array<{ statement: string; status: 'success' | 'failed'; error?: string }> = [];

  for (let i = 0; i < sqlStatements.length; i++) {
    const statement = sqlStatements[i];
    const statementNum = i + 1;
    
    try {
      console.log(`\n[${statementNum}/${sqlStatements.length}] Executing...`);
      console.log(`   ${statement.substring(0, 60)}${statement.length > 60 ? '...' : ''}`);

      // Try to execute via exec_sql RPC function
      const { data, error } = await supabase.rpc('exec_sql', {
        sql_statement: statement
      });

      if (error) {
        throw error;
      }

      console.log(`   ✅ Success`);
      results.push({ statement, status: 'success' });
      successCount++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      
      if (errorMsg.includes('Could not find the function')) {
        console.log(`   ⚠️  exec_sql function not available`);
        console.log(`   📋 Please execute SQL manually in Supabase Dashboard`);
      } else {
        console.log(`   ❌ Failed: ${errorMsg}`);
      }
      
      results.push({ statement, status: 'failed', error: errorMsg });
      failureCount++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 RLS Configuration Summary');
  console.log('='.repeat(70));
  console.log(`✅ Successful: ${successCount}/${sqlStatements.length}`);
  console.log(`❌ Failed: ${failureCount}/${sqlStatements.length}\n`);

  if (failureCount > 0) {
    console.log('⚠️  Some statements could not be executed via API\n');
    console.log('📋 Manual Execution Required:');
    console.log('1. Go to https://app.supabase.com');
    console.log('2. Select "pocket-dating-coach" project');
    console.log('3. Click "SQL Editor"');
    console.log('4. Copy SQL from: supabase/migrations/20260520_configure_rls.sql');
    console.log('5. Paste and click "Run"\n');
    process.exit(1);
  } else {
    console.log('🎉 All RLS policies applied successfully!\n');
    console.log('📋 Next Steps:');
    console.log('1. Go to Supabase Dashboard → Tables');
    console.log('2. For each table, click Security tab');
    console.log('3. Verify RLS is enabled with policies listed');
    console.log('4. Run verification tests in SQL Editor\n');
    process.exit(0);
  }
}

applyRLSPolicies().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
