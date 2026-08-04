/**
 * GET  /api/verified-vibe/ledger-consent  → { consent, enabled, entryCount }
 * POST /api/verified-vibe/ledger-consent  { enabled: boolean } → { consent, enabled }
 *
 * The man's own control over cross-conversation memory (Requirement §E). A
 * Bestie asks him in-chat the first time it would actually save him something;
 * this is where he changes his mind afterwards, in either direction.
 *
 * Turning it OFF is a LOCK, never a purge. His answers stay stored and simply go
 * unread, so switching back on restores the value instead of starting him from an
 * empty ledger. Capture is never gated on consent either — that is what makes a
 * later yes worth something immediately.
 *
 * Writing 'declined' here deliberately does NOT touch ledger_declines. That
 * counter exists to stop BESTIES nagging a man who keeps saying no to them;
 * quietly opting out from his own settings is not a Bestie being told no, and
 * counting it would push him toward the ask cap for exercising a control we gave
 * him. Same reasoning for leaving ledger_opportunities_since_ask alone.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
import { resolveUserId } from '$lib/server/require-user';
import { isLedgerEnabled, type LedgerConsent } from '$lib/server/bestie-ledger';

export const GET: RequestHandler = async ({ request }) => {
	const userId = await resolveUserId(request);
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

	const supabase = getSupabase() as any;
	try {
		const [user, count] = await Promise.all([
			supabase
				.from('verified_vibe_users')
				.select('ledger_consent')
				.eq('id', userId)
				.maybeSingle()
				.then((r: any) => r.data),
			supabase
				.from('vv_answer_ledger')
				.select('id', { count: 'exact', head: true })
				.eq('user_id', userId)
				.then((r: any) => r.count ?? 0)
		]);
		const consent = (user?.ledger_consent ?? 'unasked') as LedgerConsent;
		return json({ consent, enabled: isLedgerEnabled(consent), entryCount: count });
	} catch (err) {
		console.error('[ledger-consent] read failed:', err);
		// Degrade to the default (on, nothing stored) rather than 500ing a settings
		// screen — showing it off when it is actually on would be the lie.
		return json({ consent: 'unasked', enabled: true, entryCount: 0 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	const userId = await resolveUserId(request);
	if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = (await request.json().catch(() => ({}))) as { enabled?: unknown };
	if (typeof body.enabled !== 'boolean') {
		return json({ error: 'enabled (boolean) is required' }, { status: 400 });
	}

	const consent = body.enabled ? 'granted' : 'declined';
	const supabase = getSupabase() as any;
	try {
		const { error } = await supabase
			.from('verified_vibe_users')
			.update({ ledger_consent: consent, ledger_consent_at: new Date().toISOString() })
			.eq('id', userId);
		if (error) throw error;
	} catch (err) {
		console.error('[ledger-consent] write failed:', err);
		return json({ error: 'Could not save that right now' }, { status: 500 });
	}

	return json({ consent, enabled: body.enabled });
};
