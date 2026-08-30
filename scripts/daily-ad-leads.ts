/**
 * The daily ad-lead readout: who came in, from where, and what they did next.
 *
 *   npx tsx --env-file=.env.local scripts/daily-ad-leads.ts [days=1]
 *
 * WHY IT LEADS WITH RECONCILIATION. On 2026-08-29 Snap Ads Manager reported 9
 * leads while marketing_leads held 7, and nothing in any query said so: both
 * missing submissions were returning people, dropped by the unique indexes on
 * whatsapp_e164 and lower(email), which recordAdLead reports as a contented
 * `duplicate: true`. A report that opens with a list of names invites you to
 * believe the list is the day. This one opens with the count and the delta, and
 * says out loud when it cannot verify itself.
 *
 * WHAT IT DELIBERATELY WILL NOT DO. It will not infer gender, and it will not
 * pretend a landing-page visit belongs to a named person. Both are judgements,
 * not queries — see the notes at the bottom of the output.
 */
import { createClient } from '@supabase/supabase-js';

const DAYS = Number(process.argv[2] ?? 1);
const AD_SOURCES = ['snap_lead_form', 'meta_lead_form'] as const;
const LEAD_CAMPAIGN_MARK = 'RA_LEADS';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY are not in the environment.');
  console.error('Run with the project env loaded: npx tsx --env-file=.env.local <this file>');
  process.exit(1);
}
const supabase = createClient(url, key);

const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();
const net = (s: string) => (s === 'snap_lead_form' ? 'Snap' : 'Meta');

/** The audience is in India and so is whoever reads this; UTC helps nobody here. */
const ist = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    : '(no timestamp)';

/**
 * A burst of arrivals sharing a second is a prefetcher or a crawler, not people.
 * The 2026-08-29 data had ten such rows in three seconds; counting them would have
 * put landing-page engagement at 16 when six humans arrived.
 */
function dropBursts<T extends { created_at: string }>(rows: T[]): { kept: T[]; dropped: number } {
  const perSecond = new Map<string, T[]>();
  for (const r of rows) {
    const s = r.created_at.slice(0, 19);
    perSecond.set(s, [...(perSecond.get(s) ?? []), r]);
  }
  const kept: T[] = [];
  let dropped = 0;
  for (const group of perSecond.values()) {
    if (group.length > 2) dropped += group.length;
    else kept.push(...group);
  }
  return { kept, dropped };
}

async function main() {
  console.log(`\n=== Riteangle ad leads — last ${DAYS}d (since ${since}) ===\n`);

  // ---- 1. Reconciliation, before anything else -----------------------------
  const { data: subs, error: subsErr } = await supabase
    .from('marketing_lead_submissions')
    .select('network, outcome, submitted_at')
    .gte('submitted_at', since);

  const { data: leads, error: leadsErr } = await supabase
    .from('marketing_leads')
    .select(
      'source, first_name, last_name, email, whatsapp_e164, campaign, ad_group_name, country, city, region, submitted_at'
    )
    .in('source', AD_SOURCES as unknown as string[])
    .gte('submitted_at', since)
    .order('submitted_at', { ascending: false });

  if (leadsErr) {
    console.error('marketing_leads query failed:', leadsErr.message);
    process.exit(1);
  }

  console.log('RECONCILIATION');
  if (subsErr) {
    console.log('  marketing_lead_submissions: NOT AVAILABLE —', subsErr.message);
    console.log('  >> The submission ledger is not deployed yet, so this report CANNOT');
    console.log('     verify its own completeness. Compare the counts below against');
    console.log('     Snap and Meta Ads Manager BY HAND before trusting them.');
  } else {
    const by = (n: string, o?: string) =>
      (subs ?? []).filter((s) => s.network === n && (!o || s.outcome === o)).length;
    for (const s of AD_SOURCES) {
      console.log(
        `  ${net(s).padEnd(4)}  delivered=${by(s)}  stored=${by(s, 'stored')}  ` +
          `duplicate=${by(s, 'duplicate')}  no_contact=${by(s, 'no_usable_contact')}  under18=${by(s, 'under_18')}`
      );
    }
    console.log('  >> "delivered" is what the network sent us and should match Ads Manager.');
    console.log('     Any shortfall against Ads Manager is leads we never received at all.');
  }
  console.log(`  marketing_leads rows in window: ${leads?.length ?? 0}\n`);

  // ---- 2. The people -------------------------------------------------------
  console.log('LEADS');
  if (!leads?.length) {
    console.log('  none in this window\n');
  } else {
    const head = `  ${'PLATFORM'.padEnd(9)}${'NAME'.padEnd(26)}${'EMAIL'.padEnd(35)}${'REGION'.padEnd(16)}FILLED (IST)`;
    console.log(head);
    console.log('  ' + '-'.repeat(head.length - 2));
    for (const r of leads) {
      const name = [r.first_name, r.last_name].filter(Boolean).join(' ') || '(no name)';
      // Every one of these is null today: recordAdLead never writes a location, and
      // neither webhook payload carries one. Printed rather than omitted so the gap
      // is visible in the report instead of being mistaken for "no region column".
      const region = [r.city, r.region, r.country].filter(Boolean).join(', ') || 'not captured';
      console.log(
        `  ${net(r.source).padEnd(9)}${name.padEnd(26)}${(r.email ?? '(no email)').padEnd(35)}${region.padEnd(16)}${ist(r.submitted_at)}`
      );
    }
    console.log();
    if (leads.every((r) => !r.city && !r.region && !r.country)) {
      console.log('  REGION is null on every lead. It is not collected anywhere on this path:');
      console.log('  the Snap and Meta webhook payloads carry no location, and recordAdLead does');
      console.log('  not write one. The landing-page visit DOES carry city/region — so region');
      console.log('  arrives at the same moment per-person attribution does, when a lead row');
      console.log('  finally carries a visit_id. Until then it cannot be reported per lead.\n');
    }
  }

  // ---- 3. What happened next, in aggregate only ----------------------------
  const [views, clicks, installs] = await Promise.all([
    supabase.from('marketing_page_views').select('visit_id, campaign, created_at').gte('created_at', since),
    supabase.from('marketing_store_clicks').select('visit_id, campaign, created_at').gte('created_at', since),
    supabase.from('user_acquisition').select('campaign, platform, created_at').gte('created_at', since)
  ]);

  const onLead = <T extends { campaign: string | null }>(rows: T[] | null) =>
    (rows ?? []).filter((r) => (r.campaign ?? '').includes(LEAD_CAMPAIGN_MARK));

  const v = dropBursts(onLead(views.data as any));
  const c = onLead(clicks.data as any);
  const i = onLead(installs.data as any);
  const uniqueTapVisits = new Set(c.map((r: any) => r.visit_id).filter(Boolean)).size;

  console.log('AFTER THE FORM (lead campaigns, aggregate)');
  console.log(`  landing-page arrivals : ${v.kept.length}${v.dropped ? `  (${v.dropped} bot/prefetch rows dropped)` : ''}`);
  console.log(`  store taps            : ${c.length} across ${uniqueTapVisits} visit(s)`);
  console.log(`  installs attributed   : ${i.length}  (Android only — an absent row is unattributable, NOT organic)`);

  console.log('\nNOTES — read before quoting any of this');
  console.log('  * Per-person LP/install attribution is NOT wired. marketing_leads.visit_id and');
  console.log('    marketing_apply_gate.ra_lead are null on every row, and those are the only two');
  console.log('    keys that could join a named lead to a visit. Snap never had a per-lead id at');
  console.log('    all; Meta\'s {{lead_id}} macro is not resolving. So the numbers above are');
  console.log('    campaign-level and must not be read as "these named people did this".');
  console.log('  * Gender is not in this output on purpose. Inferring it from a first name is a');
  console.log('    judgement with a real error rate; make it in-session, and mark it inferred.');
}

main();
