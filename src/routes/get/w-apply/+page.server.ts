/**
 * /get/w-apply — server half of the qualification page.
 *
 * Two jobs: refuse a cold visit, and record the age answer.
 *
 * WHY A FORM ACTION RATHER THAN A FETCH. The page it serves has one interaction
 * and that interaction is the entire point, so it must work when JavaScript does
 * not. /get's own header explains what happened the last time this page's family
 * put content behind script — one CSS specificity collision left whole sections
 * at opacity 0 on a page we were paying for traffic to. A form action posts and
 * re-renders without a line of JS; `use:enhance` on the client only removes the
 * navigation.
 */

import { redirect, fail } from '@sveltejs/kit';
import { geoFromRequest } from '$lib/server/request-geo';
import { isAgeBand, recordApplyGate, UNDER_18 } from '$lib/server/apply-gate';
import type { Actions, PageServerLoad } from './$types';

/**
 * NO COLD ACCESS.
 *
 * This page opens mid-sentence — "one step left" — and that sentence is only
 * true for someone who just submitted the Meta form. Without `ra_lead` she did
 * not, so the framing would be a lie and the age answer would join to nothing.
 * She gets the real women's page instead, with her campaign params intact.
 *
 * This is also what stops the page being a shareable link that manufactures
 * "qualified" visitors who never applied.
 */
export const load: PageServerLoad = async ({ url }) => {
	const raLead = url.searchParams.get('ra_lead');

	/**
	 * Snap arrivals carry no lead id, by platform limitation rather than by
	 * choice: Snap's lead form has an end-page URL but documents no macro for it
	 * (checked 2026-08-29), so there is nothing per-lead to carry. The app owner's
	 * call, in as many words: proceed without the name rather than bounce her —
	 * she DID just submit the form, so "one step left" is as true for her as for
	 * a Meta arrival; the only thing lost is the per-lead join, which falls back
	 * to the ad-squad-level UTMs the URL still carries.
	 *
	 * `ra_src=form` is set ONLY on lead-form end-page URLs we author. It is
	 * guessable — anyone who reads it can skip the redirect — but the redirect
	 * was never a security boundary: it exists so the mid-sentence framing isn't
	 * shown to someone who never filled a form, and a guessed parameter is a
	 * deliberate visit, not an accident.
	 */
	const fromForm = url.searchParams.get('ra_src') === 'form';

	if (!raLead && !fromForm) {
		const onward = new URLSearchParams(url.search);
		throw redirect(307, `/get/w${onward.size ? `?${onward}` : ''}`);
	}

	/**
	 * Her first name is NOT looked up here, and the omission is deliberate rather
	 * than unfinished.
	 *
	 * Meta's completion URL carries `{{lead_id}}` and no field values, so the name
	 * can only come from reading the lead back through the Marketing API, which
	 * needs `leads_retrieval` on the system-user token. Whether that permission is
	 * actually granted was still unverified when this shipped. Rather than ship a
	 * call that fails on every render, the page is written to work without a name
	 * and to use one if it is ever passed in.
	 *
	 * When the permission is confirmed: fetch here, wrap it in a short timeout,
	 * and fall back to null on any failure. A slow Meta response must never hold
	 * up a page someone is waiting on — the greeting is a nicety and the gate is
	 * the product.
	 */
	return { firstName: null as string | null };
};

export const actions: Actions = {
	qualify: async ({ request, url }) => {
		const form = await request.formData();
		const ageBand = form.get('age_band');
		const visitId = form.get('visit_id');
		const campaign = form.get('campaign');

		if (!isAgeBand(ageBand)) {
			// Only reachable by a hand-built post; the page offers five buttons.
			return fail(400, { badBand: true });
		}

		const utm: Record<string, string> = {};
		url.searchParams.forEach((value, key) => {
			if (key.startsWith('utm_')) utm[key] = value;
		});

		const geo = geoFromRequest(request);

		// The result is deliberately not branched on. She answered a question and
		// is owed the next screen; a failed insert is our logging problem, not a
		// dead end for her. See the module header.
		await recordApplyGate({
			raLead: url.searchParams.get('ra_lead'),
			visitId: typeof visitId === 'string' && visitId ? visitId : null,
			ageBand,
			campaign: typeof campaign === 'string' && campaign ? campaign : null,
			utm,
			userAgent: request.headers.get('user-agent'),
			country: geo.country,
			city: geo.city,
			region: geo.region
		});

		return { qualified: ageBand !== UNDER_18, ageBand };
	}
};
