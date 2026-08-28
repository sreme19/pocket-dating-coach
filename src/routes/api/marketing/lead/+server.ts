import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	normaliseEmail,
	normalisePhone,
	recordLead,
	type LeadAudience,
	type LeadContactKind
} from '$lib/server/marketing-leads';
import { geoFromRequest } from '$lib/server/request-geo';
import {
	MAX_BODY_BYTES,
	MAX_CAMPAIGN,
	MAX_UA,
	ID_PATTERN,
	clamp,
	sanitizeUtm
} from '$lib/server/marketing-input';

/**
 * POST /api/marketing/lead
 *
 * The first write path Riteangle has ever had for a contactable lead off a paid
 * landing page. Fired by the capture form on /get/w.
 *
 * NOT A BEACON, despite living beside two of them. The sibling endpoints answer
 * 204 to everything because nothing is listening; here a person has typed her
 * number and is watching a button, so this answers real JSON and real statuses,
 * and every early return says something the form can render.
 *
 * Unauthenticated, like its siblings and for the same reason: anonymous ad
 * traffic on a page with no login. The defences are shape-based — a small body,
 * closed sets for page and audience, hard length caps, strict normalisation of
 * the contact itself, and unique indexes in the database so the same person
 * submitting twice writes one row.
 *
 * WHAT THIS DOES NOT DEFEND AGAINST, stated rather than implied: there is no
 * rate limit and no CAPTCHA, so a script with ten thousand distinct valid-looking
 * Indian mobile numbers can write ten thousand rows. Per-IP limiting in module
 * scope does not survive serverless, and the project has no shared limiter to
 * reach for. The exposure is bounded by what a row costs — the dialer works a
 * queue a human reviews, so junk wastes review time rather than placing calls.
 * If this page is ever run at real volume, that is the thing to fix first.
 */

/** Must match the table's check constraint. */
const ALLOWED_PAGES = new Set(['get', 'get_w', 'get_photos', 'aibestie', 'get_w_apply']);
const ALLOWED_AUDIENCE = new Set(['man', 'woman']);
const ALLOWED_KINDS = new Set(['whatsapp', 'email']);

/** Long enough for any real address, short enough that nothing large lands in the column. */
const MAX_CONTACT = 254;

export const POST: RequestHandler = async ({ request }) => {
	const declared = Number(request.headers.get('content-length') ?? 0);
	if (declared > MAX_BODY_BYTES) return json({ ok: false, error: 'too_large' }, { status: 413 });

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'bad_json' }, { status: 400 });
	}

	const page = typeof body.page === 'string' ? body.page : '';
	const audience = typeof body.audience === 'string' ? body.audience : '';
	const contactKind = typeof body.contactKind === 'string' ? body.contactKind : '';
	const value = typeof body.value === 'string' ? body.value.slice(0, MAX_CONTACT) : '';

	if (!ALLOWED_PAGES.has(page) || !ALLOWED_AUDIENCE.has(audience) || !ALLOWED_KINDS.has(contactKind)) {
		return json({ ok: false, error: 'bad_request' }, { status: 400 });
	}

	// Normalise before storing, never after. The unique indexes are on the stored
	// values, so "+91 98765 43210" and "9876543210" have to collapse to one string
	// here or they become two rows and the same person is called twice.
	const whatsappE164 = contactKind === 'whatsapp' ? normalisePhone(value) : null;
	const email = contactKind === 'email' ? normaliseEmail(value) : null;

	if (contactKind === 'whatsapp' && !whatsappE164) {
		return json({ ok: false, error: 'bad_phone' }, { status: 422 });
	}
	if (contactKind === 'email' && !email) {
		return json({ ok: false, error: 'bad_email' }, { status: 422 });
	}

	// Optional — a lead with no visit id is still a lead. It only costs the join
	// back to the arrival that produced it, which is worth strictly less than the
	// contact itself, so a missing or malformed one is dropped rather than fatal.
	const rawVisit = typeof body.visitId === 'string' ? body.visitId : '';
	const visitId = ID_PATTERN.test(rawVisit) ? rawVisit : null;

	const geo = geoFromRequest(request);

	const result = await recordLead({
		visitId,
		page: page as 'get' | 'get_w' | 'get_photos' | 'aibestie' | 'get_w_apply',
		audience: audience as LeadAudience,
		contactKind: contactKind as LeadContactKind,
		whatsappE164,
		email,
		campaign: clamp(body.campaign, MAX_CAMPAIGN),
		utm: sanitizeUtm(body.utm),
		userAgent: clamp(request.headers.get('user-agent'), MAX_UA),
		country: geo.country,
		city: geo.city,
		region: geo.region
	});

	if (!result.ok) return json({ ok: false, error: 'server' }, { status: 500 });

	// `duplicate` is deliberately NOT in the response. A caller who can tell a
	// first submission from a repeat can test whether a given number is already
	// registered, one request at a time. She sees the same confirmation either way.
	return json({ ok: true });
};
