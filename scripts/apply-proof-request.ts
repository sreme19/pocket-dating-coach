#!/usr/bin/env tsx
/**
 * Apply the in-chat proof-request migration
 * (20260706090000_add_proof_request_to_matches.sql).
 * Idempotent: ADD COLUMN IF NOT EXISTS — safe to re-run.
 *
 * Usage: tsx --env-file=.env.local scripts/apply-proof-request.ts
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const MIGRATION = 'supabase/migrations/20260706090000_add_proof_request_to_matches.sql';

function statements(sql: string): string[] {
  const noComments = sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');
  return noComments
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  console.log(`\n📍 ${SUPABASE_URL}`);
  const stmts = statements(readFileSync(MIGRATION, 'utf8'));
  console.log(`📄 ${stmts.length} statements from ${MIGRATION}\n`);

  for (const s of stmts) {
    const label = s.replace(/\s+/g, ' ').slice(0, 70);
    const { error } = await db.rpc('exec_sql', { sql_statement: s });
    if (error) {
      console.error(`❌ ${label}… → ${error.message}`);
      process.exit(1);
    }
    console.log(`✅ ${label}…`);
  }

  // Verify the column is readable.
  const { error: verifyErr } = await db
    .from('verified_vibe_matches')
    .select('id, proof_request')
    .limit(1);
  if (verifyErr) {
    console.error(`❌ verify failed: ${verifyErr.message}`);
    process.exit(1);
  }
  console.log('\n🎉 proof_request column live and readable.');
}

main();
