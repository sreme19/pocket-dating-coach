/**
 * Server-side load for /aibestie — so the gate knows who she is on the FIRST PAINT.
 *
 * The page used to learn her name from a client-side probe fired after hydration,
 * which meant the very first thing a paid click saw was an empty photo frame above
 * "Meet her's AI bestie" — a placeholder and a grammatical error, on the one screen
 * whose whole job is to make someone who just tapped an advert want to stay.
 *
 * IT RENDERS HER NAME WITHOUT HARDCODING IT. A literal "Linda" would read correctly
 * today and be a lie the moment the roster rotates — exactly the bug 1bde3fe fixed
 * in the <title>, which said "Jessica" while the page was serving Linda. The roster
 * is env-driven, so the name has to be looked up, and doing it here means it is
 * looked up before the HTML is sent rather than after.
 *
 * The client probe stays as the fallback. This load can fail — a database blip, a
 * cold region — and a landing page that shows nothing is worse than one that fills
 * in a beat late.
 */

import type { PageServerLoad } from './$types';
import { readGateState } from '$lib/server/aibestie-session';

export const load: PageServerLoad = async () => {
	try {
		return { gate: await readGateState() };
	} catch {
		// Null, not a thrown error: the page falls back to the client probe, and the
		// probe itself defaults to 'artifact'. No failure path can upgrade the page
		// into claiming a person is reading.
		return { gate: null };
	}
};
