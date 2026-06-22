#!/usr/bin/env tsx
/**
 * Apply the unified pool table migration (20260620000000_create_vv_pool_profiles.sql)
 * and report the backfill result. Idempotent: "already exists" errors are tolerated
 * so it can be re-run safely. Does NOT touch vv_pool_wingmen / vv_pool_besties.
 *
 * Usage: tsx --env-file=.env.local scripts/apply-pool-profiles.ts
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

const MIGRATION = 'supabase/migrations/20260620000000_create_vv_pool_profiles.sql';

/** Split a comment-free SQL file into individual statements (no functions/$$ here). */
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

async function execSql(sql: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await db.rpc('exec_sql', { sql_statement: sql });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function main() {
  console.log(`\n📍 ${SUPABASE_URL}`);
  const stmts = statements(readFileSync(MIGRATION, 'utf8'));
  console.log(`📄 ${stmts.length} statements from ${MIGRATION}\n`);

  let fatal = false;
  for (let i = 0; i < stmts.length; i++) {
    const s = stmts[i];
    const label = s.replace(/\s+/g, ' ').slice(0, 70);
    const { ok, error } = await execSql(s);
    if (ok) {
      console.log(`[${i + 1}/${stmts.length}] ✅ ${label}`);
    } else if (/already exists|duplicate/i.test(error ?? '')) {
      console.log(`[${i + 1}/${stmts.length}] ⏭️  exists — ${label}`);
    } else if (/Could not find the function .*exec_sql/i.test(error ?? '')) {
      console.error(`\n❌ exec_sql RPC not available on this project.`);
      console.error(`   Run ${MIGRATION} manually in the Supabase SQL editor instead.`);
      process.exit(2);
    } else {
      console.error(`[${i + 1}/${stmts.length}] ❌ ${label}\n     ${error}`);
      fatal = true;
    }
  }

  // ── Verify ──
  const { count: total } = await db.from('vv_pool_profiles').select('*', { count: 'exact', head: true });
  const { count: wm } = await db.from('vv_pool_profiles').select('*', { count: 'exact', head: true }).eq('assistant_type', 'wingman');
  const { count: bs } = await db.from('vv_pool_profiles').select('*', { count: 'exact', head: true }).eq('assistant_type', 'bestie');
  const { count: srcW } = await db.from('vv_pool_wingmen').select('*', { count: 'exact', head: true });
  const { count: srcB } = await db.from('vv_pool_besties').select('*', { count: 'exact', head: true });

  console.log(`\n── Backfill check ─────────────────────────────`);
  console.log(`vv_pool_wingmen : ${srcW} → wingman rows : ${wm}`);
  console.log(`vv_pool_besties : ${srcB} → bestie  rows : ${bs}`);
  console.log(`vv_pool_profiles total: ${total}`);

  const { data: sample } = await db.from('vv_pool_profiles').select('user_id, assistant_type, match_profile, preferences').limit(2);
  console.log(`\nSample rows:\n${JSON.stringify(sample, null, 2)}`);

  process.exit(fatal ? 1 : 0);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
