/**
 * One-off importer: Snap "Account leads" backlog (Excel export, converted to JSON)
 * -> marketing_leads.
 *
 * WHY THIS EXISTS
 * ---------------
 * Snap's API lead webhook never delivered (see ad-management-agent
 * research/questions/q-2026-08-30-why-has-no-snap-lead.md). The 90-day account
 * leads backlog was pulled by hand from Ads Manager (Download -> Account leads)
 * and is ingested here so the leads are usable, not just saved. Future leads flow
 * via the Google Sheets direct integration + its own sync; this script is the
 * historical catch-up only.
 *
 * It MIRRORS recordAdLead() in src/lib/server/marketing-leads.ts:
 *   - same target columns, same normalisers (phone -> +91 E.164, email lowercased)
 *   - insert-or-treat-23505-as-duplicate; dedupe rides the three partial unique
 *     indexes (ad_lead_id, lower(email), whatsapp_e164). Re-running is safe.
 *
 * GENDER is INFERRED from the person's first name (dictionary in
 * scripts/lib/indian-names-gender.json), null when ambiguous, and stored under
 * utm.inferred_gender (+ utm.inferred_gender_source) so it never overwrites the
 * `audience` column, whose meaning is the ad's TARGET audience, not the submitter.
 * This inference has a real error rate and low coverage; treat it as a hint.
 *
 * USAGE
 *   npx tsx --env-file=.env.local scripts/import-snap-leads-backlog.ts <leads.json>            # dry-run (default)
 *   npx tsx --env-file=.env.local scripts/import-snap-leads-backlog.ts <leads.json> --commit    # actually insert
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
// Shared with the live sync endpoint — single source of truth for the dictionary.
// infer-gender.ts is pure (JSON only, no $lib/$env), so tsx can import it directly.
import { inferGenderFromName } from '../src/lib/server/infer-gender';

// Normalisers copied verbatim from src/lib/server/marketing-leads.ts — importing
// that module pulls in $lib/$env, which don't resolve in a standalone tsx script.
// Keep these in sync if the originals change.
function normalisePhone(raw: string): string | null {
	const digits = raw.replace(/[^\d]/g, '');
	const local =
		digits.startsWith('91') && digits.length === 12
			? digits.slice(2)
			: digits.startsWith('0') && digits.length === 11
				? digits.slice(1)
				: digits;
	if (!/^[6-9]\d{9}$/.test(local)) return null;
	return `+91${local}`;
}
function normaliseEmail(raw: string): string | null {
	const email = raw.trim().toLowerCase();
	if (email.length > 254) return null;
	return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email) ? email : null;
}

type RawLead = {
	lead_id: string | null;
	created_time: string | null;
	first_name: string | null;
	surname: string | null;
	email: string | null;
	phone_raw: string | null;
	campaign_id: string | null;
	ad_set_id: string | null;
	ad_id: string | null;
};

/**
 * Snap exports Indian numbers in 10/12/14-digit forms (bare, 91-prefixed,
 * 0091-prefixed). normalisePhone() only handles the first two, so reduce to the
 * last 10 digits first, then let normalisePhone validate the [6-9] mobile prefix.
 */
function normaliseSnapPhone(raw: string | null): string | null {
	if (!raw) return null;
	const digits = raw.replace(/[^\d]/g, '');
	const local = digits.length > 10 ? digits.slice(-10) : digits;
	return normalisePhone(local);
}

type Mapped = {
	raw: RawLead;
	adLeadId: string | null;
	email: string | null;
	phone: string | null;
	gender: 'man' | 'woman' | null;
	firstName: string | null;
	lastName: string | null;
	submittedAt: string | null;
	hasContact: boolean;
};

function mapLead(r: RawLead): Mapped {
	const email = r.email ? normaliseEmail(r.email) : null;
	const phone = normaliseSnapPhone(r.phone_raw);
	return {
		raw: r,
		adLeadId: r.lead_id ?? null,
		email,
		phone,
		gender: inferGenderFromName(r.first_name),
		firstName: r.first_name ?? null,
		lastName: r.surname ?? null,
		submittedAt: r.created_time ?? null,
		hasContact: Boolean(email || phone)
	};
}

const UNIQUE_VIOLATION = '23505';

async function main() {
	const args = process.argv.slice(2);
	const commit = args.includes('--commit');
	const jsonPath = args.find((a) => !a.startsWith('--'));
	if (!jsonPath) {
		console.error('Usage: import-snap-leads-backlog.ts <leads.json> [--commit]');
		process.exit(1);
	}

	const url = process.env.SUPABASE_URL;
	const key = process.env.SUPABASE_SERVICE_KEY;
	if (!url || !key) {
		console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY are not in the environment.');
		process.exit(1);
	}
	const supabase = createClient(url, key);

	const raw = JSON.parse(readFileSync(jsonPath, 'utf8')) as RawLead[];
	const mapped = raw.map(mapLead);

	const importable = mapped.filter((m) => m.hasContact);
	const noContact = mapped.filter((m) => !m.hasContact);

	// --- dedupe pre-check: which incoming rows already exist by any unique key ---
	const leadIds = [...new Set(importable.map((m) => m.adLeadId).filter(Boolean) as string[])];
	const emails = [...new Set(importable.map((m) => m.email).filter(Boolean) as string[])];
	const phones = [...new Set(importable.map((m) => m.phone).filter(Boolean) as string[])];

	const existing = { leadIds: new Set<string>(), emails: new Set<string>(), phones: new Set<string>() };
	const chunk = <T>(a: T[], n = 200) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
	for (const c of chunk(leadIds)) {
		const { data } = await supabase.from('marketing_leads').select('ad_lead_id').in('ad_lead_id', c);
		data?.forEach((d: any) => d.ad_lead_id && existing.leadIds.add(d.ad_lead_id));
	}
	for (const c of chunk(emails)) {
		const { data } = await supabase.from('marketing_leads').select('email').in('email', c);
		data?.forEach((d: any) => d.email && existing.emails.add(String(d.email).toLowerCase()));
	}
	for (const c of chunk(phones)) {
		const { data } = await supabase.from('marketing_leads').select('whatsapp_e164').in('whatsapp_e164', c);
		data?.forEach((d: any) => d.whatsapp_e164 && existing.phones.add(d.whatsapp_e164));
	}

	const isDup = (m: Mapped) =>
		(m.adLeadId && existing.leadIds.has(m.adLeadId)) ||
		(m.email && existing.emails.has(m.email)) ||
		(m.phone && existing.phones.has(m.phone));

	const toInsert = importable.filter((m) => !isDup(m));
	const dupes = importable.filter((m) => isDup(m));

	const gCount = (list: Mapped[]) => ({
		man: list.filter((m) => m.gender === 'man').length,
		woman: list.filter((m) => m.gender === 'woman').length,
		unknown: list.filter((m) => m.gender === null).length
	});

	console.log('\n=== Snap leads backlog import ' + (commit ? '(COMMIT)' : '(DRY-RUN)') + ' ===');
	console.log('source file           :', jsonPath);
	console.log('rows in file          :', raw.length);
	console.log('  with usable contact :', importable.length, '(email or phone after normalisation)');
	console.log('  NO contact (skipped):', noContact.length);
	console.log('  with email          :', importable.filter((m) => m.email).length);
	console.log('  with phone          :', importable.filter((m) => m.phone).length);
	console.log('already in DB (dup)    :', dupes.length, '(by ad_lead_id / email / phone)');
	console.log('NEW to insert         :', toInsert.length);
	console.log('inferred gender (new)  :', gCount(toInsert), '=> coverage',
		Math.round((100 * (gCount(toInsert).man + gCount(toInsert).woman)) / Math.max(1, toInsert.length)) + '%');

	if (!commit) {
		console.log('\nDRY-RUN: nothing written. Re-run with --commit to insert the NEW rows.');
		return;
	}

	let inserted = 0, duplicate = 0, failed = 0;
	for (const m of toInsert) {
		const { error } = await supabase.from('marketing_leads').insert({
			source: 'snap_lead_form',
			page: 'snap_lead_form',
			contact_kind: m.phone ? 'phone' : 'email',
			ad_lead_id: m.adLeadId,
			whatsapp_e164: m.phone,
			email: m.email,
			first_name: m.firstName,
			last_name: m.lastName,
			audience: null,
			ad_campaign_id: m.raw.campaign_id,
			ad_group_id: m.raw.ad_set_id,
			ad_id: m.raw.ad_id,
			submitted_at: m.submittedAt,
			utm: m.gender ? { inferred_gender: m.gender, inferred_gender_source: 'first_name' } : {}
		});
		if (!error) inserted++;
		else if (error.code === UNIQUE_VIOLATION) duplicate++;
		else { failed++; console.error('  insert failed:', error.code, error.message); }
	}
	console.log(`\nCOMMIT done: inserted ${inserted}, duplicate(23505) ${duplicate}, failed ${failed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
