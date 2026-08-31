import { json, text } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import {
	normalisePhone,
	normaliseEmail,
	recordAdLead,
	recordLeadSubmission,
	type LeadAudience,
	type LeadSubmissionOutcome
} from '$lib/server/marketing-leads';

/**
 * POST /api/marketing/snap-sheet-sync
 *
 * The delivery path of record for Snap lead forms. Snap's Marketing API webhook
 * never fires (see ad-management-agent `rules/lead-delivery.md` and
 * `q-2026-08-30-why-has-no-snap-lead`): the only integration Ads Manager will
 * actually connect is Snap's native Google Sheets "Direct integration", which
 * pushes one row per submission into a per-form sheet. This endpoint is the other
 * half of that pipe — a Google Apps Script time-driven trigger on the sheet POSTs
 * new rows here every ~30 minutes, and each row is upserted into marketing_leads.
 *
 * WHY A SHEET AND A SWEEP RATHER THAN THE WEBHOOK. The sheet is a durable buffer:
 * a lead survives even if this endpoint is down, because the next sweep re-sends
 * it. That property is only worth anything if re-sending is safe — so this
 * endpoint is IDEMPOTENT. recordAdLead dedupes on ad_lead_id / phone / email
 * (all three unique indexes), so a row that was already stored comes back as a
 * contented `duplicate` and writes nothing. The Apps Script may therefore overlap
 * its windows freely; the database is the source of truth on what is new.
 *
 * NOT A BEACON AND NOT A BROWSER FORM. Like the webhook sibling, this answers a
 * machine, and it writes to a contact list. Two rules follow:
 *   - Authenticated before a single field is read. The transport is a plain
 *     shared secret rather than Snap's HMAC, because the caller is our own Apps
 *     Script, not Snap — but an unauthenticated body must still never write a row.
 *   - Every delivered row is counted in marketing_lead_submissions, whatever
 *     becomes of it (stored / duplicate / no_usable_contact). That ledger is what
 *     lets the daily readout reconcile against Ads Manager instead of presenting a
 *     silently-deduped DB count as the day's total — the exact failure of
 *     2026-08-29. The sheet is the network's number; this table is our echo of it.
 */

/** A sweep payload is small; anything large is not one. */
const MAX_BODY_BYTES = 512 * 1024;

/**
 * The Apps Script presents the shared secret as `x-sync-secret`, with a Bearer
 * fallback so a future caller that can only set Authorization still works.
 */
function presentedSecret(headers: Headers): string | null {
	const direct = headers.get('x-sync-secret');
	if (direct) return direct.trim();
	const auth = headers.get('authorization');
	if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
	return null;
}

/**
 * Constant-time compare. timingSafeEqual throws on a length mismatch rather than
 * returning false, which would turn a wrong secret into a 500; the length guard
 * keeps a wrong secret a clean 401.
 */
function secretMatches(presented: string, expected: string): boolean {
	const a = Buffer.from(presented, 'utf8');
	const b = Buffer.from(expected, 'utf8');
	if (a.length !== b.length) return false;
	try {
		return timingSafeEqual(a, b);
	} catch {
		return false;
	}
}

function str(value: unknown): string | null {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Snap's Indian numbers arrive in 10/12/14-digit forms (bare, 91-prefixed,
 * 0091-prefixed). Reduce to the last 10 digits, then let normalisePhone validate
 * the [6-9] mobile prefix. Mirrors normaliseSnapPhone in the backlog importer —
 * kept local so this endpoint has no dependency on a one-off script.
 */
function normaliseSheetPhone(raw: string | null): string | null {
	if (!raw) return null;
	const digits = raw.replace(/[^\d]/g, '');
	const local = digits.length > 10 ? digits.slice(-10) : digits;
	return normalisePhone(local);
}

/**
 * Snap's ad squads encode gender in the name. Mirrors audienceFromNames in the
 * webhook — see that file for why whitespace is a separator too, and why both-or-
 * neither is a deliberate null rather than a guess.
 */
function audienceFromNames(...names: (string | null)[]): LeadAudience | null {
	const haystack = names.filter(Boolean).join(' ').toUpperCase();
	const woman = /(^|[_\s])(F|W|WOMEN|WOMAN|FEMALE)([_\s]|$)/.test(haystack);
	const man = /(^|[_\s])(M|MEN|MAN|MALE)([_\s]|$)/.test(haystack);
	if (woman === man) return null;
	return woman ? 'woman' : 'man';
}

/**
 * Snap's synthetic sample lead, which its "Send test report" button drops into
 * the sheet exactly as it fires at the webhook. Mirrors isSnapTestPayload, plus
 * one addition specific to the sheet: Snap's own template row prefixes EVERY
 * field with "Test: " (seen in the Ads Manager download header row), so any field
 * carrying that prefix marks the whole row synthetic. A false positive costs one
 * dropped lead; a false negative writes a fabricated person into a list a dialer
 * works through.
 */
function isTestRow(row: SheetRow): boolean {
	const values = Object.values(row).map((v) => (str(v) ?? '').toLowerCase());
	if (values.some((v) => v.startsWith('test:'))) return true;

	const email = (str(row.email) ?? '').toLowerCase();
	if (email.endsWith('@snapchat.com')) return true;

	const names = [row.campaignName, row.adName, row.adSquadName, row.formName]
		.map((v) => (str(v) ?? '').toLowerCase())
		.filter(Boolean);
	if (names.some((n) => n.startsWith('snap test') || n.includes('test campaign name'))) return true;

	return (str(row.firstName) ?? '').toLowerCase() === 'sample lead first name';
}

/**
 * The sheet's columns, named as Snap's Google Sheets integration writes them
 * (the same headers as the Ads Manager "Account leads" export). Every field is
 * optional at the type level because a hand-edited sheet can drop any of them;
 * the row is validated at use, not here.
 */
interface SheetRow {
	formId?: string;
	formName?: string;
	campaignId?: string;
	campaignName?: string;
	adId?: string;
	adName?: string;
	adSquadId?: string;
	adSquadName?: string;
	leadId?: string;
	createTime?: string;
	firstName?: string;
	lastName?: string;
	email?: string;
	phoneNumber?: string;
	leadStatus?: string;
}

interface Summary {
	received: number;
	stored: number;
	duplicate: number;
	no_contact: number;
	test_skipped: number;
	no_lead_id: number;
	failed: number;
}

export const POST: RequestHandler = async ({ request }) => {
	const secret = env.SNAP_SHEET_SYNC_SECRET;
	if (!secret) {
		// 500, not 401: the caller is legitimate and the fault is ours, so the
		// Apps Script should treat this as retryable rather than as a rejection.
		console.error('[snap-sheet-sync] SNAP_SHEET_SYNC_SECRET is not set — refusing leads');
		return json({ ok: false, error: 'server_misconfigured' }, { status: 500 });
	}

	const presented = presentedSecret(request.headers);
	if (!presented || !secretMatches(presented, secret)) {
		console.error('[snap-sheet-sync] missing or wrong shared secret');
		return json({ ok: false, error: 'unauthorized' }, { status: 401 });
	}

	const declared = Number(request.headers.get('content-length') ?? 0);
	if (declared > MAX_BODY_BYTES) return json({ ok: false, error: 'too_large' }, { status: 413 });

	const raw = await request.text();
	if (raw.length > MAX_BODY_BYTES) return json({ ok: false, error: 'too_large' }, { status: 413 });

	let body: { rows?: unknown };
	try {
		body = JSON.parse(raw);
	} catch {
		return json({ ok: false, error: 'bad_json' }, { status: 400 });
	}

	const rows = body.rows;
	if (!Array.isArray(rows)) {
		return json({ ok: false, error: 'rows_must_be_array' }, { status: 400 });
	}

	const summary: Summary = {
		received: rows.length,
		stored: 0,
		duplicate: 0,
		no_contact: 0,
		test_skipped: 0,
		no_lead_id: 0,
		failed: 0
	};

	for (const item of rows as SheetRow[]) {
		const leadId = str(item.leadId);
		if (!leadId) {
			// A row Snap has not finished writing, or a blank trailing row the sheet
			// read swept up. Nothing to dedupe on, so it is skipped, not stored.
			summary.no_lead_id++;
			continue;
		}

		if (isTestRow(item)) {
			summary.test_skipped++;
			continue;
		}

		const campaignName = str(item.campaignName);
		const adSquadName = str(item.adSquadName);
		const adName = str(item.adName);

		const countSubmission = (outcome: LeadSubmissionOutcome) =>
			recordLeadSubmission({
				network: 'snap_lead_form',
				adLeadId: leadId,
				adFormId: str(item.formId),
				outcome,
				campaign: campaignName,
				adCampaignId: str(item.campaignId),
				adGroupId: str(item.adSquadId),
				adGroupName: adSquadName,
				adId: str(item.adId),
				adName,
				submittedAt: str(item.createTime)
			});

		const whatsappE164 = normaliseSheetPhone(str(item.phoneNumber));
		const email = normaliseEmail(str(item.email) ?? '');

		if (!whatsappE164 && !email) {
			summary.no_contact++;
			await countSubmission('no_usable_contact');
			continue;
		}

		const result = await recordAdLead({
			network: 'snap_lead_form',
			adLeadId: leadId,
			adFormId: str(item.formId),
			whatsappE164,
			email,
			firstName: str(item.firstName),
			lastName: str(item.lastName),
			audience: audienceFromNames(adSquadName, campaignName, adName),
			campaign: campaignName,
			adCampaignId: str(item.campaignId),
			adGroupId: str(item.adSquadId),
			adGroupName: adSquadName,
			adId: str(item.adId),
			adName,
			submittedAt: str(item.createTime)
		});

		if (!result.ok) {
			// A transient write failure. NOT counted (so the ledger does not claim a
			// lead we did not store) and reported back so the Apps Script leaves it
			// for the next sweep — which is safe precisely because recordAdLead is
			// idempotent.
			summary.failed++;
			continue;
		}

		if (result.duplicate) {
			summary.duplicate++;
			await countSubmission('duplicate');
		} else {
			summary.stored++;
			await countSubmission('stored');
		}
	}

	console.warn('[snap-sheet-sync] sweep complete', summary);

	// Always 200 when authenticated and well-formed. Per-row failures are carried
	// in the body, not the status: the sweep is a batch, and one bad row must not
	// make the Apps Script discard the good ones it also sent.
	return json({ ok: true, ...summary });
};

/**
 * A reachability check for the Apps Script setup step and for confirming the
 * secret is configured before a real lead depends on it. Never reveals the
 * secret; only whether one is set.
 */
export const GET: RequestHandler = async () =>
	text(env.SNAP_SHEET_SYNC_SECRET ? 'ok' : 'missing SNAP_SHEET_SYNC_SECRET', {
		status: env.SNAP_SHEET_SYNC_SECRET ? 200 : 500
	});
