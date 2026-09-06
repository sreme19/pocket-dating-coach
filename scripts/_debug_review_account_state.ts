import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!) as any;
const EMAIL = 'review@riteangle.com';
(async () => {
  for (let page = 1; page <= 8; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 50 });
    if (error) { console.error(`page ${page} error:`, error.message); break; }
    const users = data?.users || [];
    const hit = users.find((x: any) => (x.email || '').toLowerCase() === EMAIL);
    if (hit) {
      console.log(`FOUND ${EMAIL}  id=${hit.id}`);
      console.log(`  confirmed: ${hit.email_confirmed_at ? 'yes' : 'NO'}   last_sign_in: ${hit.last_sign_in_at || 'never'}`);
      const { data: row } = await db.from('verified_vibe_users')
        .select('archetype, gender, trust_score, first_name, is_seed, is_provisional')
        .eq('id', hit.id).maybeSingle();
      if (!row) { console.log('  NO verified_vibe_users row => needsOnboarding TRUE => ONBOARDING LADDER. BLOCKER.'); return; }
      const needs = !row.archetype || row.archetype === '';
      console.log(`  archetype: ${row.archetype || '(EMPTY)'}  gender: ${row.gender || '(none)'}  trust_score: ${row.trust_score}`);
      console.log(`\n  needsOnboarding() => ${needs}`);
      console.log(needs ? '  => REVIEWER LANDS ON ONBOARDING LADDER, not Discover. BLOCKER.'
                        : '  => Reviewer goes straight to the Discover feed. Good.');
      return;
    }
    if (users.length < 50) { console.log(`${EMAIL} not found in ${(page-1)*50 + users.length} auth users.`); return; }
  }
})();
