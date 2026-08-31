/**
 * Inferred submitter gender from a first name.
 *
 * WHY THIS IS "INFERRED" AND WHY IT RETURNS null SO OFTEN. Gender-from-first-name
 * is a judgement with a real error rate — daily-ad-leads.ts deliberately refuses
 * to do it in code for exactly that reason. It lives here anyway because Sree
 * asked for a derived gender on the leads, with the explicit understanding that it
 * is a hint, not a fact: dictionary-only, and null on anything unknown OR listed
 * under both genders. The value is written to marketing_leads.utm.inferred_gender
 * (with inferred_gender_source), NEVER to the `audience` column — `audience` means
 * the ad's TARGET gender (from the ad-squad name), which is a different claim.
 *
 * Coverage on the real Snap backlog was ~25% (203/269 unknown). Treat a null as
 * "we don't know", never as a signal, and extend indian-names-gender.json as gaps
 * surface rather than reaching for a fuzzy heuristic that manufactures false ones.
 */
import dict from './indian-names-gender.json';

export type InferredGender = 'man' | 'woman';

const MALE = new Set((dict.male as string[]).map((s) => s.toLowerCase()));
const FEMALE = new Set((dict.female as string[]).map((s) => s.toLowerCase()));

export function inferGenderFromName(firstName: string | null | undefined): InferredGender | null {
	const token = (firstName ?? '').trim().toLowerCase().split(/\s+/)[0];
	if (!token) return null;
	const m = MALE.has(token);
	const f = FEMALE.has(token);
	if (m && !f) return 'man';
	if (f && !m) return 'woman';
	return null; // unknown, or ambiguous (in both lists) — do not guess
}
