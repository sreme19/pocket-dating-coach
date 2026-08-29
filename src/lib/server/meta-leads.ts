import { env } from '$env/dynamic/private';
import { normalisePhone, normaliseEmail, type AdLeadInput } from '$lib/server/marketing-leads';

/**
 * Meta lead-ad retrieval.
 *
 * THE SHAPE IS DIFFERENT FROM SNAP'S, in one way that matters. Snap's webhook
 * carries the whole lead. Meta's carries only a `leadgen_id`; the fields are a
 * second call away. So there is no such thing as a Meta lead pipeline that does
 * not hold a Graph token, and `leads_retrieval` is required for the webhook just
 * as much as for the backfill.
 *
 * WHAT META HAS THAT SNAP DOES NOT: GET /{form_id}/leads. A real, pageable list
 * endpoint. That is why the 122 leads already sitting on the Page can be
 * backfilled through the API instead of exported by hand the way Snap's 260 were.
 *
 * The version is pinned, for the reason ad-management-agent's meta.py pins it:
 * Meta began auto-upgrading unpinned callers on 2026-07-29, and an auto-upgrade
 * that silently changes what a payload means is not something to find out from a
 * live funnel.
 */
const API_VERSION = 'v26.0';
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;

export class MetaLeadError extends Error {}

function marketingToken(): string {
	const token = env.META_MARKETING_TOKEN ?? env.META_ADS_TOKEN ?? '';
	if (!token) throw new MetaLeadError('META_MARKETING_TOKEN is not set');
	return token;
}

async function graph(path: string, token: string): Promise<Record<string, unknown>> {
	const sep = path.includes('?') ? '&' : '?';
	const res = await fetch(`${GRAPH}${path}${sep}access_token=${encodeURIComponent(token)}`);
	const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
	if (!res.ok) {
		const err = (body.error ?? {}) as Record<string, unknown>;
		// Surfaced verbatim: (#200) Requires leads_retrieval permission is the one
		// failure everything here turns on, and paraphrasing it wastes the reader's
		// time working out whether it is a token, a scope or a page assignment.
		throw new MetaLeadError(`GET ${path} -> HTTP ${res.status}: ${err.message ?? 'unknown'}`);
	}
	return body;
}

/**
 * A Page access token, derived from the system-user token.
 *
 * Lead data lives on the Page and Meta refuses to hand it over to an ad-account
 * token — the same "(#190) must be called with a Page Access Token" that
 * ad-management-agent's meta.py hit when READING leadgen_forms. If the page's
 * access_token field comes back empty the system user is not assigned to the
 * Page, and the fix is in Business Settings rather than in this file.
 */
export async function pageToken(): Promise<string> {
	const pageId = env.META_PAGE_ID;
	if (!pageId) throw new MetaLeadError('META_PAGE_ID is not set');
	const res = await graph(`/${pageId}?fields=access_token`, marketingToken());
	const token = res.access_token;
	if (typeof token !== 'string' || !token) {
		throw new MetaLeadError(
			'the system-user token cannot act as the Page: reading access_token returned nothing. ' +
				'Assign the Page to the system user in Business Settings (Users -> System users -> ' +
				'Assign assets, with Manage permission).'
		);
	}
	return token;
}

/** The fields worth asking for. `field_data` is where the contact details are. */
const LEAD_FIELDS = 'id,created_time,ad_id,adset_id,campaign_id,form_id,field_data';

export interface RawLead {
	id: string;
	created_time?: string;
	ad_id?: string;
	adset_id?: string;
	campaign_id?: string;
	form_id?: string;
	field_data?: Array<{ name?: string; values?: string[] }>;
}

export async function fetchLead(leadgenId: string, token: string): Promise<RawLead> {
	return (await graph(`/${leadgenId}?fields=${LEAD_FIELDS}`, token)) as unknown as RawLead;
}

/** One page of a form's leads, plus the cursor to continue. */
export async function fetchFormLeads(
	formId: string,
	token: string,
	after?: string
): Promise<{ leads: RawLead[]; next?: string }> {
	const cursor = after ? `&after=${encodeURIComponent(after)}` : '';
	const res = await graph(`/${formId}/leads?fields=${LEAD_FIELDS}&limit=100${cursor}`, token);
	const paging = (res.paging ?? {}) as Record<string, unknown>;
	const cursors = (paging.cursors ?? {}) as Record<string, unknown>;
	return {
		leads: (res.data ?? []) as RawLead[],
		// Only report a cursor when Meta says there IS a next page. `after` is
		// present on the last page too, and following it loops forever.
		next: paging.next ? (cursors.after as string | undefined) : undefined
	};
}

export async function listLeadForms(
	token: string
): Promise<Array<{ id: string; name: string; leads_count: number }>> {
	const pageId = env.META_PAGE_ID;
	const res = await graph(`/${pageId}/leadgen_forms?fields=id,name,leads_count&limit=100`, token);
	return (res.data ?? []) as Array<{ id: string; name: string; leads_count: number }>;
}

/** Ad-object names, which the lead itself does not carry. Cached per run. */
export async function resolveNames(
	ids: string[],
	token: string,
	cache: Map<string, string>
): Promise<void> {
	const missing = [...new Set(ids.filter((id) => id && !cache.has(id)))];
	for (let i = 0; i < missing.length; i += 50) {
		const batch = missing.slice(i, i + 50);
		try {
			const res = await graph(`/?ids=${batch.join(',')}&fields=name`, token);
			for (const [id, obj] of Object.entries(res)) {
				const name = (obj as Record<string, unknown>)?.name;
				if (typeof name === 'string') cache.set(id, name);
			}
		} catch {
			// A name is a nicety; a lead is not. Never let this lose the lead —
			// audience falls back to null, which is the honest answer anyway.
		}
	}
}

function field(lead: RawLead, ...names: string[]): string | null {
	for (const want of names) {
		const hit = lead.field_data?.find((f) => f.name === want);
		const value = hit?.values?.[0];
		if (typeof value === 'string' && value.trim()) return value.trim();
	}
	return null;
}

/**
 * Same rule the Snap receiver uses, and it lives here too rather than being
 * imported across route boundaries: Meta's ad sets carry the gender marker in
 * the name (RA_LEADS_CASUAL_WOMEN_TOF_*), and whitespace counts as a separator
 * because hand-made objects are named "Female Leads".
 */
export function audienceFromNames(...names: (string | null | undefined)[]): 'man' | 'woman' | null {
	const haystack = names.filter(Boolean).join(' ').toUpperCase();
	const woman = /(^|[_\s])(F|W|WOMEN|WOMAN|FEMALE)([_\s]|$)/.test(haystack);
	const man = /(^|[_\s])(M|MEN|MAN|MALE)([_\s]|$)/.test(haystack);
	if (woman === man) return null;
	return woman ? 'woman' : 'man';
}

/** True when the declared birthday puts them under 18. Null when not collected. */
export function isMinor(lead: RawLead): boolean | null {
	const raw = field(lead, 'date_of_birth', 'birthday', 'dob');
	if (!raw) return null;
	const born = new Date(raw);
	if (Number.isNaN(born.getTime())) return null;
	const now = new Date();
	let age = now.getUTCFullYear() - born.getUTCFullYear();
	const md = now.getUTCMonth() - born.getUTCMonth();
	if (md < 0 || (md === 0 && now.getUTCDate() < born.getUTCDate())) age -= 1;
	return age < 18;
}

/**
 * Meta's lead into the shape marketing_leads takes.
 *
 * Returns null when there is no usable contact — an international number
 * normalisePhone rejects by design, or a form collecting neither field. The
 * caller decides what that means; for a webhook it is a 200, because redelivery
 * would produce exactly the same result.
 */
export function toAdLead(lead: RawLead, names: Map<string, string>): AdLeadInput | null {
	const phoneRaw = field(lead, 'phone_number', 'phone');
	const emailRaw = field(lead, 'email');
	const whatsappE164 = phoneRaw ? normalisePhone(phoneRaw) : null;
	const email = emailRaw ? normaliseEmail(emailRaw) : null;
	if (!whatsappE164 && !email) return null;

	const full = field(lead, 'full_name');
	const firstName = field(lead, 'first_name') ?? (full ? full.split(/\s+/)[0] : null);
	const lastName =
		field(lead, 'last_name') ?? (full && full.includes(' ') ? full.split(/\s+/).slice(1).join(' ') : null);

	const adGroupName = lead.adset_id ? (names.get(lead.adset_id) ?? null) : null;
	const campaignName = lead.campaign_id ? (names.get(lead.campaign_id) ?? null) : null;
	const adName = lead.ad_id ? (names.get(lead.ad_id) ?? null) : null;

	return {
		network: 'meta_lead_form',
		adLeadId: lead.id,
		adFormId: lead.form_id ?? null,
		whatsappE164,
		email,
		firstName,
		lastName,
		audience: audienceFromNames(adGroupName, campaignName, adName),
		campaign: campaignName,
		adCampaignId: lead.campaign_id ?? null,
		adGroupId: lead.adset_id ?? null,
		adGroupName,
		adId: lead.ad_id ?? null,
		adName,
		submittedAt: lead.created_time ?? null
	};
}
