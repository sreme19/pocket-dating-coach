/**
 * One-off backfill: populate utm.inferred_gender on existing ad-lead rows.
 *
 * The Snap/Meta sync now derives an inferred gender from the first name (see
 * infer-gender.ts), but rows written before that change carry no gender. This
 * fills them in — dictionary-only, null skipped (we only write a value we have),
 * merged into utm without disturbing any other key. Idempotent: rows that already
 * have utm.inferred_gender are left alone, so it is safe to re-run.
 *
 *   npx tsx --env-file=.env.local scripts/backfill-inferred-gender.ts            # dry-run
 *   npx tsx --env-file=.env.local scripts/backfill-inferred-gender.ts --commit    # apply
 */
import { createClient } from '@supabase/supabase-js';
import { inferGenderFromName } from '../src/lib/server/infer-gender';

async function main() {
	const commit = process.argv.includes('--commit');
	const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

	// Ad-lead rows with a name and no inferred_gender yet.
	const { data, error } = await s
		.from('marketing_leads')
		.select('id, first_name, utm, source')
		.in('source', ['snap_lead_form', 'meta_lead_form'])
		.not('first_name', 'is', null);
	if (error) {
		console.error('query failed:', error.message);
		process.exit(1);
	}
	const rows = data ?? [];

	let already = 0, man = 0, woman = 0, unknown = 0, updated = 0, failed = 0;
	for (const r of rows as { id: string; first_name: string | null; utm: Record<string, unknown> | null }[]) {
		const utm = r.utm ?? {};
		if (utm.inferred_gender) { already++; continue; }
		const g = inferGenderFromName(r.first_name);
		if (g === 'man') man++;
		else if (g === 'woman') woman++;
		else { unknown++; continue; } // nothing to write

		if (commit) {
			const { error: uErr } = await s
				.from('marketing_leads')
				.update({ utm: { ...utm, inferred_gender: g, inferred_gender_source: 'first_name' } })
				.eq('id', r.id);
			if (uErr) { failed++; console.error('  update failed', r.id, uErr.message); }
			else updated++;
		}
	}

	console.log('\n=== backfill inferred_gender ' + (commit ? '(COMMIT)' : '(DRY-RUN)') + ' ===');
	console.log('ad-lead rows with a name :', rows.length);
	console.log('  already had gender     :', already);
	console.log('  -> man                 :', man);
	console.log('  -> woman               :', woman);
	console.log('  -> unknown (skipped)   :', unknown, `(coverage ${Math.round((100 * (man + woman)) / Math.max(1, rows.length - already))}% of the un-set)`);
	if (commit) console.log('updated rows             :', updated, '| failed:', failed);
	else console.log('\nDRY-RUN: nothing written. Re-run with --commit to apply.');
}

main().catch((e) => { console.error(e); process.exit(1); });
