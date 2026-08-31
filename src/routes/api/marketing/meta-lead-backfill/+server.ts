import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { recordAdLead } from '$lib/server/marketing-leads';
import { recordApplyGate, UNDER_18 } from '$lib/server/apply-gate';
import {
	fetchFormLeads,
	isMinor,
	listLeadForms,
	pageToken,
	resolveNames,
	toAdLead
} from '$lib/server/meta-leads';

/**
 * POST /api/marketing/meta-lead-backfill
 *
 * Pull every lead already sitting on the Page's forms into marketing_leads.
 *
 * THIS EXISTS BECAUSE META HAS WHAT SNAP DOES NOT: GET /{form_id}/leads. Snap's
 * 260 historical leads had to be exported to a spreadsheet by hand and loaded
 * row by row, because Snap has no endpoint that lists a lead. Meta's do not, and
 * building the manual path twice would have been a choice rather than a
 * constraint.
 *
 * SAFE TO RE-RUN, and meant to be. Every row deduplicates on ad_lead_id, on the
 * phone and on lower(email), so a second pass writes nothing and reports
 * duplicates instead. That also makes it a usable backstop for the webhook: if a
 * delivery is ever lost, running this recovers it, within Meta's own 90-day
 * retention.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>, the same shape the voice reaper
 * uses. Not the admin cookie — this is a machine endpoint.
 */

/** Bound the work per invocation so a serverless timeout cannot truncate silently. */
const MAX_LEADS = 2000;

function authorized(request: Request): boolean {
	const secret = env.CRON_SECRET;
	if (!secret) return false;
	const header = request.headers.get('authorization') ?? '';
	return header.startsWith('Bearer ') && header.slice(7) === secret;
}

const handle: RequestHandler = async ({ request, url }) => {
	if (!authorized(request)) return json({ ok: false }, { status: 401 });

	// A dry run reports what it WOULD write and touches nothing. Worth having on
	// the first pass against a live contact list.
	const dryRun = url.searchParams.get('dry_run') === '1';
	const onlyForm = url.searchParams.get('form_id');

	let token: string;
	try {
		token = await pageToken();
	} catch (err) {
		return json({ ok: false, error: String(err) }, { status: 502 });
	}

	let forms;
	try {
		forms = await listLeadForms(token);
	} catch (err) {
		return json({ ok: false, error: String(err) }, { status: 502 });
	}
	if (onlyForm) forms = forms.filter((f) => f.id === onlyForm);

	const names = new Map<string, string>();
	const perForm: Record<string, { seen: number; stored: number; duplicate: number; skipped: number }> = {};
	let seen = 0;
	let stored = 0;
	let duplicate = 0;
	let skipped = 0;
	let minors = 0;
	const errors: string[] = [];
	let truncated = false;

	for (const form of forms) {
		if (!form.leads_count) continue;
		const tally = { seen: 0, stored: 0, duplicate: 0, skipped: 0 };
		perForm[form.name || form.id] = tally;
		let after: string | undefined;

		do {
			let page;
			try {
				page = await fetchFormLeads(form.id, token, after);
			} catch (err) {
				// Record and move on. One inaccessible form must not cost the
				// other ten — and the report says which failed rather than
				// reporting a total that quietly excludes it.
				errors.push(`${form.name || form.id}: ${String(err)}`);
				break;
			}

			await resolveNames(
				page.leads.flatMap((l) => [l.adset_id, l.campaign_id, l.ad_id]).filter(Boolean) as string[],
				token,
				names
			);

			for (const lead of page.leads) {
				seen++;
				tally.seen++;
				if (seen > MAX_LEADS) {
					truncated = true;
					break;
				}

				if (isMinor(lead) === true) {
					minors++;
					skipped++;
					tally.skipped++;
					if (!dryRun) {
						await recordApplyGate({
							raLead: lead.id,
							visitId: null,
							ageBand: UNDER_18,
							campaign: null,
							utm: {},
							userAgent: null,
							country: null,
							city: null,
							region: null
						});
					}
					continue;
				}

				const mapped = toAdLead(lead, names);
				if (!mapped) {
					skipped++;
					tally.skipped++;
					continue;
				}
				if (dryRun) {
					stored++;
					tally.stored++;
					continue;
				}

				const result = await recordAdLead(mapped);
				if (!result.ok) {
					errors.push(`lead ${lead.id}: ${result.reason}`);
					continue;
				}
				if (result.duplicate) {
					duplicate++;
					tally.duplicate++;
				} else {
					stored++;
					tally.stored++;
				}
			}

			after = truncated ? undefined : page.next;
		} while (after);

		if (truncated) break;
	}

	// `truncated` is reported rather than swallowed: a caller that sees a total
	// and no warning is entitled to believe the total is everything.
	return json({
		ok: errors.length === 0,
		dryRun,
		forms: forms.length,
		seen,
		stored,
		duplicate,
		skipped,
		minors,
		truncated,
		perForm,
		errors
	});
};

/**
 * GET and POST both run the backfill. GET exists because Vercel Cron invokes its
 * targets with a GET (and injects `Authorization: Bearer <CRON_SECRET>`), so the
 * scheduled Meta-lead sweep in vercel.json reaches this handler; POST stays for
 * manual/ad-hoc invocation. Auth is identical for both — the Bearer check gates
 * a write to a contact list regardless of method. Same shape as the /api/cron/*
 * handlers (see ad-spend-sync).
 */
export const GET = handle;
export const POST = handle;
