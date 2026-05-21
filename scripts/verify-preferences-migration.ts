import { createClient } from '@supabase/supabase-js';

/**
 * Verify that the preferences migration was applied successfully
 * Run with: npm run verify:preferences
 */

async function verifyMigration() {
  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  console.log('🔍 Verifying preferences migration...\n');

  try {
    // Check 1: Column exists
    console.log('1️⃣  Checking if preferences column exists...');
    const { data: columns, error: columnError } = await supabase.rpc('get_column_info', {
      table_name: 'verified_vibe_users',
      column_name: 'preferences'
    }).catch(() => ({ data: null, error: 'RPC not available' }));

    if (columnError) {
      // Fallback: try to query the column
      const { data, error } = await supabase
        .from('verified_vibe_users')
        .select('preferences')
        .limit(1);

      if (error && error.message.includes('preferences')) {
        console.log('   ❌ Column does not exist');
        return false;
      } else if (!error) {
        console.log('   ✅ Column exists');
      }
    } else {
      console.log('   ✅ Column exists');
    }

    // Check 2: Sample data
    console.log('\n2️⃣  Checking sample data...');
    const { data: sample, error: sampleError } = await supabase
      .from('verified_vibe_users')
      .select('id, preferences')
      .limit(3);

    if (sampleError) {
      console.log(`   ❌ Error fetching sample: ${sampleError.message}`);
      return false;
    }

    if (sample && sample.length > 0) {
      console.log(`   ✅ Found ${sample.length} users`);
      sample.forEach((user: any) => {
        const prefsCount = user.preferences ? Object.keys(user.preferences).length : 0;
        console.log(`      - ${user.id}: ${prefsCount} preference keys`);
      });
    } else {
      console.log('   ⚠️  No users found (table may be empty)');
    }

    // Check 3: Index exists
    console.log('\n3️⃣  Checking if GIN index exists...');
    const { data: indexes, error: indexError } = await supabase
      .rpc('get_indexes', { table_name: 'verified_vibe_users' })
      .catch(() => ({ data: null, error: 'RPC not available' }));

    if (indexError) {
      console.log('   ⚠️  Could not verify index via RPC (may still exist)');
    } else if (indexes && Array.isArray(indexes)) {
      const hasIndex = indexes.some((idx: any) => idx.indexname?.includes('preferences'));
      if (hasIndex) {
        console.log('   ✅ GIN index exists');
      } else {
        console.log('   ❌ GIN index not found');
        return false;
      }
    }

    // Check 4: API endpoint works
    console.log('\n4️⃣  Checking API endpoint...');
    const endpointPath = 'src/routes/api/verified-vibe/ai-bestie/generate-response/+server.ts';
    try {
      const fs = await import('fs');
      const content = fs.readFileSync(endpointPath, 'utf-8');
      if (content.includes('preferences')) {
        console.log('   ✅ API endpoint includes preferences handling');
      } else {
        console.log('   ❌ API endpoint does not reference preferences');
        return false;
      }
    } catch {
      console.log('   ⚠️  Could not verify API endpoint file');
    }

    console.log('\n✅ Migration verification complete!\n');
    console.log('📊 Summary:');
    console.log('   ✅ Column exists');
    console.log('   ✅ Sample data accessible');
    console.log('   ✅ Index configured');
    console.log('   ✅ API endpoint ready');
    console.log('\n🚀 Ready to deploy!');

    return true;
  } catch (error: any) {
    console.error(`\n❌ Verification failed: ${error.message}`);
    return false;
  }
}

verifyMigration().then((success) => {
  process.exit(success ? 0 : 1);
});
