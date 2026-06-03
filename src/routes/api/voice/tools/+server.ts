import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import { verifyWorkerSecret } from '$lib/server/voice-auth';

/**
 * POST /api/voice/tools  (worker-only)
 *
 * The bestie voice agent invokes its tools through here mid-call. These are the
 * voice equivalents of the text bestie's in-band markers — kept as real side
 * effects so the voice bestie has true feature parity, without ever speaking a
 * control token aloud.
 *
 * Body: { callId, tool: 'save_preference'|'draft_message'|'lookup_match_fact', args }
 */
export const POST: RequestHandler = async ({ request }) => {
	if (!verifyWorkerSecret(request)) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = (await request.json()) as {
		callId?: string;
		tool?: string;
		args?: Record<string, any>;
	};
	if (!body.callId || !body.tool) return json({ error: 'Missing callId or tool' }, { status: 400 });

	const supabase = getSupabase();
	const { data: call } = await (supabase as any)
		.from('vv_voice_calls')
		.select('id, match_id, owner_user_id, caller_user_id, drafts')
		.eq('id', body.callId)
		.single();
	if (!call) return json({ error: 'Call not found' }, { status: 404 });

	const args = body.args ?? {};

	try {
		switch (body.tool) {
			case 'save_preference': {
				const type = String(args.type || '');
				const value = String(args.value || '').trim().slice(0, 120);
				if (!value) return json({ ok: false, error: 'empty value' });
				const { loadPreferences, updatePreferences } = await import('$lib/server/profile-service');
				const current = await loadPreferences(call.owner_user_id);
				const patch: Record<string, string[]> = {};
				if (type === 'dealbreaker') patch.dealbreakers = [...new Set([...current.dealbreakers, value])];
				else if (type === 'boundary') patch.boundaries = [...new Set([...current.boundaries, value])];
				else if (type === 'signal') patch.emotionalSignals = [...new Set([...current.emotionalSignals, value])];
				else patch.privateCompatibilityNotes = [...new Set([...current.privateCompatibilityNotes, value])];
				await updatePreferences(call.owner_user_id, patch, `From bestie voice call ${body.callId}`);
				return json({ ok: true, saved: { type, value } });
			}

			case 'draft_message': {
				const text = String(args.text || '').trim().slice(0, 1000);
				if (!text) return json({ ok: false, error: 'empty draft' });
				const drafts = Array.isArray(call.drafts) ? call.drafts : [];
				drafts.push({ text, ts: new Date().toISOString() });
				await (supabase as any).from('vv_voice_calls').update({ drafts }).eq('id', body.callId);
				return json({ ok: true, draftCount: drafts.length });
			}

			case 'lookup_match_fact': {
				// Return the real grounding facts so the agent answers from data, not
				// guesses. Compact, spoken-friendly.
				const [{ data: owner }, { data: caller }, artifacts] = await Promise.all([
					supabase
						.from('verified_vibe_users')
						.select('first_name, about, looking, preferences')
						.eq('id', call.owner_user_id)
						.single()
						.then((r) => r),
					supabase
						.from('verified_vibe_users')
						.select('first_name, about')
						.eq('id', call.caller_user_id)
						.single()
						.then((r) => r),
					(supabase as any)
						.from('user_artifacts')
						.select('claim_tag')
						.eq('user_id', call.caller_user_id)
						.then((r: any) => r.data)
						.catch(() => null)
				]);
				const proofTags = artifacts?.length
					? [...new Set(artifacts.map((a: any) => a.claim_tag))].join(', ')
					: 'none on file';
				return json({
					ok: true,
					facts: {
						owner: {
							name: (owner as any)?.first_name ?? null,
							about: (owner as any)?.about ?? null,
							looking: (owner as any)?.looking ?? null,
							preferences: (owner as any)?.preferences ?? null
						},
						match: {
							name: (caller as any)?.first_name ?? null,
							about: (caller as any)?.about ?? null,
							verifiedProofs: proofTags
						}
					}
				});
			}

			default:
				return json({ error: `Unknown tool: ${body.tool}` }, { status: 400 });
		}
	} catch (e) {
		console.error('[voice/tools] failed:', e);
		return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};
