/**
 * add-neha-matches.ts
 *
 * Matches 5 random existing male seed users with Neha (keeping Adrian).
 * Safe to re-run — skips any match that already exists.
 *
 * Usage:
 *   tsx --env-file=.env.local scripts/add-neha-matches.ts
 *
 * Optional: pass specific slugs to override random selection
 *   tsx --env-file=.env.local scripts/add-neha-matches.ts karan ryan ethan
 */

import { createClient } from '@supabase/supabase-js';

const NEHA_EMAIL = 'neha_nri_diaspora_x5r2vd@seed.vv';
const ADRIAN_FOLDER = 'adrian_Ambitious_Young_Tech_j9k4bz';

// All existing male profile folder names (21 total)
const ALL_MALE_FOLDERS = [
  'alex_Monogamish_t9n2cw',
  'arjun_Progressive_Traditional_e2m8cw',
  'daniel_Emotionally_Available_v2r6ys',
  'dante_BDSM_Dominant_q5r7bx',
  'ethan_Golden_Retriever_q7n5wc',
  'finn_Conflict_Avoidant_w5p8el',
  'greg_Casually_Ambitious_m6x2vt',
  'jake_Serial_Monogamist_c3n7qr',
  'john_Young_Student_nsysor',
  'kai_ENM_Polyamorous_w8m3ns',
  'karan_Progressive_Traditional_u9j5ql',
  'luca_Emotionally_Immature_d8h3tk',
  'marcus_Self_Made_Ambitious_b3k9rz',
  'michael_Perpetually_Busy_a4s9uf',
  'owen_Swinger_f3k8yv',
  'rohan_Family_Pressure_Registrant_t6f3xp',
  'ryan_Serial_Dater_f4m2px',
  'tim_VC_Founder_ono35i',
  'tyler_Nice_Guy_Overextended_h7b5nk',
  'victor_Sugar_Daddy_e6p4rl',
];

// Good defaults: varied archetypes, interesting for AI Bestie analysis
const DEFAULT_PICKS = [
  'karan_Progressive_Traditional_u9j5ql',  // culturally relevant for Neha
  'ryan_Serial_Dater_f4m2px',              // finance bro / red flags
  'daniel_Emotionally_Available_v2r6ys',  // emotionally unavailable / avoidant
  'michael_Perpetually_Busy_a4s9uf',      // recently divorced, complicated
  'ethan_Golden_Retriever_q7n5wc',        // tech bro, different vibe
];

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('💕  Add Neha Matches — Pocket Dating Coach');
  console.log('='.repeat(60) + '\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('✗ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Resolve which 5 males to pick ──────────────────────────────────────
  const cliArgs = process.argv.slice(2); // e.g. "karan ryan ethan"
  let picks: string[];

  if (cliArgs.length >= 1) {
    // CLI args: match on first-name prefix or full folder name
    picks = cliArgs.map(arg => {
      const match = ALL_MALE_FOLDERS.find(
        f => f === arg || f.toLowerCase().startsWith(arg.toLowerCase() + '_')
      );
      if (!match) {
        console.warn(`  ⚠ No folder found matching "${arg}" — skipping`);
        return null;
      }
      return match;
    }).filter(Boolean) as string[];

    if (picks.length === 0) {
      console.error('✗ None of the provided names matched existing folders');
      process.exit(1);
    }
    console.log(`📋 Using CLI-specified picks (${picks.length}):`);
  } else {
    // Default: use curated list, fall back to random if needed
    picks = DEFAULT_PICKS.filter(f => ALL_MALE_FOLDERS.includes(f));
    if (picks.length < 5) {
      const extras = shuffled(ALL_MALE_FOLDERS.filter(f => !picks.includes(f)));
      picks = [...picks, ...extras].slice(0, 5);
    }
    console.log('📋 Using default picks (5 varied archetypes):');
  }

  for (const f of picks) console.log(`   • ${f}`);
  console.log();

  // ── Find Neha's user ID ────────────────────────────────────────────────
  console.log('🔍 Looking up Neha...');
  const { data: allUsers, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    console.error('✗ Failed to list users:', listErr.message);
    process.exit(1);
  }

  const nehaAuth = allUsers.users.find(u => u.email === NEHA_EMAIL);
  if (!nehaAuth) {
    console.error(`✗ Neha (${NEHA_EMAIL}) not found. Run seed-profiles.ts first.`);
    process.exit(1);
  }
  const nehaId = nehaAuth.id;
  console.log(`  ✓ Neha found: ${nehaId}\n`);

  // ── Look up each male's user ID by seed email ──────────────────────────
  console.log('🔍 Looking up male seed users...');
  const maleIds: { folder: string; userId: string; firstName: string }[] = [];

  for (const folder of picks) {
    const email = `${folder.toLowerCase()}@seed.vv`;
    const authUser = allUsers.users.find(u => u.email === email);
    if (!authUser) {
      console.warn(`  ⚠ No auth user for ${email} — skipping. Run seed-profiles.ts first.`);
      continue;
    }
    const firstName = folder.split('_')[0];
    maleIds.push({ folder, userId: authUser.id, firstName });
    console.log(`  ✓ ${firstName}: ${authUser.id}`);
  }
  console.log();

  if (maleIds.length === 0) {
    console.error('✗ No valid male users found. Run seed-profiles.ts first.');
    process.exit(1);
  }

  // ── Create matches ─────────────────────────────────────────────────────
  console.log('💞 Creating matches with Neha...');
  let created = 0;
  let skipped = 0;

  // Also check Adrian is still matched (don't recreate, just verify)
  const adrianEmail = `${ADRIAN_FOLDER.toLowerCase()}@seed.vv`;
  const adrianAuth = allUsers.users.find(u => u.email === adrianEmail);
  if (adrianAuth) {
    const { data: adrianMatch } = await supabase
      .from('verified_vibe_matches')
      .select('id')
      .or(`and(user1_id.eq.${adrianAuth.id},user2_id.eq.${nehaId}),and(user1_id.eq.${nehaId},user2_id.eq.${adrianAuth.id})`)
      .maybeSingle();
    console.log(`  ${adrianMatch ? '✓ Adrian match already exists (kept)' : '⚠ Adrian match not found — run seed-profiles.ts to create it'}`);
  }

  for (const { folder, userId, firstName } of maleIds) {
    // Check if match already exists (either direction)
    const { data: existing } = await supabase
      .from('verified_vibe_matches')
      .select('id')
      .or(`and(user1_id.eq.${userId},user2_id.eq.${nehaId}),and(user1_id.eq.${nehaId},user2_id.eq.${userId})`)
      .maybeSingle();

    if (existing) {
      console.log(`  ↩ ${firstName}: match already exists — skipping`);
      skipped++;
      continue;
    }

    const { error } = await supabase
      .from('verified_vibe_matches')
      .insert({
        user1_id: userId,       // male
        user2_id: nehaId,       // female
        status: 'mutual',
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error(`  ✗ ${firstName}: failed — ${error.message}`);
    } else {
      console.log(`  ✓ ${firstName}: matched with Neha`);
      created++;
    }
  }

  console.log(`\n✅ Done. Created ${created} new match${created !== 1 ? 'es' : ''}, skipped ${skipped} existing.\n`);

  // ── Summary ────────────────────────────────────────────────────────────
  const { data: allNehaMatches } = await supabase
    .from('verified_vibe_matches')
    .select('user1_id, user2_id')
    .or(`user1_id.eq.${nehaId},user2_id.eq.${nehaId}`)
    .eq('status', 'mutual');

  console.log(`📊 Neha now has ${allNehaMatches?.length ?? '?'} total match${(allNehaMatches?.length ?? 0) !== 1 ? 'es' : ''}.`);
  console.log('   Run: tsx --env-file=.env.local scripts/refresh-seed-profiles.ts');
  console.log('   to sync personality/preferences into ai_assistant_profiles.\n');
}

main().catch(err => {
  console.error('\n✗ Fatal error:', err.message);
  process.exit(1);
});
