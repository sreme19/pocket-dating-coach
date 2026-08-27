/**
 * Send a captured lead to our own server.
 *
 * The third member of the marketing/*-report family and the odd one out. The
 * other two are beacons: fire-and-forget, silent on failure, because measurement
 * is never allowed to break the page. This one is the page — she typed a number
 * and pressed a button, so it awaits the answer and reports it, and the caller
 * renders the outcome.
 *
 * Same attribution payload as the beacons so a lead can be joined back to the
 * arrival that produced it and attributed to the campaign that paid for it: the
 * visit id, the utm_* off the URL, and the campaign label the page resolved.
 */

import { getVisitId } from './visit-id';
import type { LandingPage } from './page-view-report';

const ENDPOINT = '/api/marketing/lead';

export type LeadContactKind = 'whatsapp' | 'email';

export interface LeadSubmission {
	page: LandingPage;
	audience: 'man' | 'woman';
	contactKind: LeadContactKind;
	/** Raw, as typed. The server normalises — doing it in two places invites drift. */
	value: string;
	campaign: string;
	url: URL;
}

/**
 * Why an outcome union rather than a thrown error: every branch here has a
 * different thing to say to her. A bad number is her typo and she can fix it; a
 * server fault is ours and she should be told to try again, not to check her
 * number; and an offline phone should not read as a rejected number.
 */
export type LeadOutcome =
	| { status: 'ok' }
	| { status: 'invalid'; field: 'phone' | 'email' }
	| { status: 'error' };

export async function submitLead(input: LeadSubmission): Promise<LeadOutcome> {
	const utm: Record<string, string> = {};
	input.url.searchParams.forEach((value, key) => {
		if (key.startsWith('utm_')) utm[key] = value;
	});

	try {
		const res = await fetch(ENDPOINT, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				visitId: getVisitId(),
				page: input.page,
				audience: input.audience,
				contactKind: input.contactKind,
				value: input.value,
				campaign: input.campaign,
				utm
			})
		});

		if (res.ok) return { status: 'ok' };

		// 422 is the only status that means she can fix it herself.
		if (res.status === 422) {
			return { status: 'invalid', field: input.contactKind === 'whatsapp' ? 'phone' : 'email' };
		}
		return { status: 'error' };
	} catch {
		// Offline, blocked, DNS — indistinguishable from here, and all of them mean
		// "not your fault, try again" rather than "your number is wrong".
		return { status: 'error' };
	}
}
