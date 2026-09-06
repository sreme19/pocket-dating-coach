// READ-ONLY. How many real members pass the Discover gate today (row presence)
// vs how many would pass if the gate required status='completed'.
import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!) as any;
(async () => {
  const { data: users } = await db.from('verified_vibe_users')
    .select('id, gender').eq('is_seed', false).eq('is_provisional', false);
  const { data: steps } = await db.from('verified_vibe_verification').select('user_id, step, status');
  const anyRow = new Map<string, Set<string>>(), doneRow = new Map<string, Set<string>>();
  for (const s of steps || []) {
    if (!anyRow.has(s.user_id)) anyRow.set(s.user_id, new Set());
    anyRow.get(s.user_id)!.add(s.step);
    if (s.status === 'completed') {
      if (!doneRow.has(s.user_id)) doneRow.set(s.user_id, new Set());
      doneRow.get(s.user_id)!.add(s.step);
    }
  }
  const gate = (m: Map<string, Set<string>>, id: string) => {
    const st = m.get(id); return st?.has('liveness') === true && st?.has('photos') === true;
  };
  let now = 0, after = 0, lost = 0;
  const lostByGender: Record<string, number> = {};
  const afterByGender: Record<string, number> = {};
  for (const u of users || []) {
    const a = gate(anyRow, u.id), b = gate(doneRow, u.id);
    if (a) now++;
    if (b) { after++; afterByGender[u.gender] = (afterByGender[u.gender] || 0) + 1; }
    if (a && !b) { lost++; lostByGender[u.gender] = (lostByGender[u.gender] || 0) + 1; }
  }
  console.log(`real members:                 ${users?.length}`);
  console.log(`pass gate TODAY (row exists): ${now}`);
  console.log(`pass if status='completed':   ${after}`);
  console.log(`would DROP out of Discover:   ${lost}  ${JSON.stringify(lostByGender)}`);
  console.log(`remaining pool by gender:     ${JSON.stringify(afterByGender)}`);
  // Status breakdown for the two gating steps
  const counts: Record<string, number> = {};
  for (const s of steps || []) if (s.step === 'liveness' || s.step === 'photos')
    counts[`${s.step}:${s.status}`] = (counts[`${s.step}:${s.status}`] || 0) + 1;
  console.log('gating-step status counts:   ', counts);
})();
