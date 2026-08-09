/**
 * POST /api/attribution/install   { utm, referrerRaw, landingPage, claimCode, platform, capturedAt }
 *
 * Records which advert produced this member, from the Play install referrer the
 * device read at first launch and held until there was a session to attach it to.
 *
 * Auth is his real Supabase session, for the ordinary reason: the row is keyed on
 * the user, so the user has to be proven rather than claimed. An unauthenticated
 * version of this endpoint would let anyone write anybody's attribution, which is
 * a strange thing to want and a very easy thing to poison a spend report with.
 *
 * Idempotent by design. The app calls this at startup AND after the onboarding
 * step that writes gender, because either one can be the first moment a session
 * exists; the insert ignores conflicts so the second call is a no-op rather than
 * a rewrite. See user-acquisition.ts for why first touch has to win.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { recordAcquisition } from '$lib/server/user-acquisition';
import { sanitizeUtm, clamp, MAX_BODY_BYTES } from '$lib/server/marketing-input';

const MAX_REFERRER_RAW = 1_000;
const MAX_LANDING_PAGE = 40;
const MAX_CLAIM_CODE = 32;

export const POST: RequestHandler = async ({ request }) => {
	const declared = Number(request.headers.get('content-length') ?? 0);
	if (declared > MAX_BODY_BYTES) return json({ error: 'too_large' }, { status: 413 });

	const header = request.headers.get('authorization') ?? '';
	const token = header.startsWith('Bearer ') ? header.slice(7) : null;
	if (!token) return json({ error: 'unauthorized' }, { status: 401 });

	let userId: string;
	try {
		const client = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
			global: { headers: { Authorization: `Bearer ${token}` } }
		});
		const {
			data: { user }
		} = await client.auth.getUser();
		if (!user) return json({ error: 'unauthorized' }, { status: 401 });
		userId = user.id;
	} catch {
		return json({ error: 'unauthorized' }, { status: 401 });
	}

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'bad_request' }, { status: 400 });
	}

	// Only android can produce a referrer today. iOS is accepted so the platform
	// split is recorded honestly rather than inferred from an absence — an iOS
	// member with no row is unattributable, which is not the same as organic.
	const rawPlatform = typeof body.platform === 'string' ? body.platform : '';
	const platform = rawPlatform === 'ios' ? 'ios' : 'android';

	// A timestamp from a device clock, which can be wrong or deliberately absurd.
	// Anything unparseable or in the future is dropped rather than stored: a
	// capture date after today would sort into a week that has not happened and
	// silently distort every cohort it lands in.
	const capturedAt = (() => {
		const raw = typeof body.capturedAt === 'string' ? body.capturedAt : '';
		if (!raw) return null;
		const at = Date.parse(raw);
		if (Number.isNaN(at) || at > Date.now()) return null;
		return new Date(at).toISOString();
	})();

	const result = await recordAcquisition({
		userId,
		utm: sanitizeUtm(body.utm),
		referrerRaw: clamp(body.referrerRaw, MAX_REFERRER_RAW),
		landingPage: clamp(body.landingPage, MAX_LANDING_PAGE),
		claimCode: clamp(body.claimCode, MAX_CLAIM_CODE),
		platform,
		capturedAt
	});

	// 200 either way, with the outcome in the body. The device uses this to decide
	// whether to stop retrying, and a failed write it should retry later is not a
	// client error — the commonest cause is a migration that has not been run yet.
	return json({ recorded: result.recorded });
};
