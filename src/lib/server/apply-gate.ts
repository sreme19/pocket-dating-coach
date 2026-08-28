/**
 * Record the age answer given on /get/w-apply.
 *
 * WHY THIS EXISTS SEPARATELY FROM marketing-leads.ts. On this funnel the contact
 * details are captured inside Meta's instant form, not on our page — v1 exports
 * them by hand — so at the moment she answers there is no marketing_leads row to
 * attach an age to. What we hold instead is `ra_lead`, Meta's own lead id,
 * carried onto the URL by the thank-you screen. This module writes that id, the
 * band she chose and the verdict, and the CSV export joins to it later.
 *
 * THE GATE IS REAL, WHICH IS THE WHOLE POINT. The page tells her she has
 * qualified. That claim is only true because 18+ is a genuine eligibility
 * condition — compliance.md 6.3, both networks' dating-category rules, and the
 * product's own verification. `qualified` is therefore stored, not derived: if
 * the bands are ever changed, a later read must still see what this visitor was
 * actually told.
 *
 * NO CONTACT DETAILS PASS THROUGH HERE. An opaque id, a band and a verdict. This
 * is a measurement table and it does not become a contact list.
 *
 * A FAILED WRITE MUST NOT BLOCK HER. Unlike marketing-leads.ts — where she typed
 * a number and is owed an answer — nobody is waiting on this row. She answered a
 * question and is owed the next screen. So the caller shows the outcome either
 * way and this module reports failure for the logs rather than for her.
 */

import { getSupabase } from '$lib/server/supabase';

/** The bands the page offers. Must match the table's check constraint. */
export const AGE_BANDS = ['18-20', '21-24', '25-30', '31+', 'under-18'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

/** The one band that fails the gate. Named so the rule is greppable. */
export const UNDER_18: AgeBand = 'under-18';

export function isAgeBand(value: unknown): value is AgeBand {
	return typeof value === 'string' && (AGE_BANDS as readonly string[]).includes(value);
}

export interface ApplyGateInput {
	raLead: string | null;
	visitId: string | null;
	ageBand: AgeBand;
	campaign: string | null;
	utm: Record<string, string>;
	userAgent: string | null;
	country: string | null;
	city: string | null;
	region: string | null;
}

export type ApplyGateResult = { ok: true } | { ok: false; reason: string };

export async function recordApplyGate(input: ApplyGateInput): Promise<ApplyGateResult> {
	try {
		const supabase = getSupabase();

		const { error } = await supabase.from('marketing_apply_gate').insert({
			ra_lead: input.raLead,
			visit_id: input.visitId,
			age_band: input.ageBand,
			qualified: input.ageBand !== UNDER_18,
			campaign: input.campaign,
			utm: input.utm,
			user_agent: input.userAgent,
			country: input.country,
			city: input.city,
			region: input.region
		});

		if (error) {
			// Logged loudly for the same reason marketing-leads.ts logs: PostgREST
			// reports a missing column, a failed check or an RLS refusal in `error`
			// rather than throwing. An invisible failure here means an under-18
			// answer we believe we recorded and did not, which is the one row that
			// must never go missing.
			console.error('[marketing] apply gate NOT recorded:', error.code, error.message, error.hint ?? '');
			return { ok: false, reason: error.message };
		}

		return { ok: true };
	} catch (err) {
		console.error('[marketing] failed to record apply gate', err);
		return { ok: false, reason: 'exception' };
	}
}
