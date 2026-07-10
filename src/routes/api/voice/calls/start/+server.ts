import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import { getUserFromRequest } from '$lib/server/voice-auth';
import { resolveVoice } from '$lib/server/elevenlabs';
import { mintJoinToken, dispatchVoiceAgent, livekitWsUrl } from '$lib/server/livekit';

/**
 * POST /api/voice/calls/start
 *
 * The male match taps "Get a call now". We verify he's in the match, that the
 * female owner has opted into bestie calls, pick the voice (her clone or the
 * default), create a LiveKit room + call record, dispatch the agent, and return
 * the caller's join token. The live conversation then runs on the worker.
 *
 * Body: { matchId: string, consent: true }
 * Returns: { callId, room, token, wsUrl, ownerName }
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const caller = await getUserFromRequest(request);
		if (!caller) return json({ error: 'Unauthorized' }, { status: 401 });

		const body = (await request.json()) as { matchId?: string; consent?: boolean };
		if (!body.matchId) return json({ error: 'Missing matchId' }, { status: 400 });
		if (body.consent !== true) {
			return json({ error: 'Caller consent to the AI call is required' }, { status: 400 });
		}

		const supabase = getSupabase();

		// Verify the match + that the caller is part of it.
		const { data: match } = await supabase
			.from('verified_vibe_matches')
			.select('id, user1_id, user2_id, status')
			.eq('id', body.matchId)
			.single();
		if (!match) return json({ error: 'Conversation not found' }, { status: 404 });
		if (match.user1_id !== caller.id && match.user2_id !== caller.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
		// No voice calls on an ended (unmatched/blocked) match.
		if (match.status === 'unmatched' || match.status === 'blocked') {
			return json({ error: 'Conversation not found' }, { status: 404 });
		}

		const ownerId = match.user1_id === caller.id ? match.user2_id : match.user1_id;

		// Resolve owner identity + that she's a woman with calls enabled.
		const { data: ownerUser } = await supabase
			.from('verified_vibe_users')
			.select('first_name, gender')
			.eq('id', ownerId)
			.single();
		if (!ownerUser) return json({ error: 'Match owner not found' }, { status: 404 });

		const { data: profile } = await (supabase as any)
			.from('vv_voice_profiles')
			.select('voice_status, elevenlabs_voice_id, calls_opt_in')
			.eq('user_id', ownerId)
			.maybeSingle();

		// Bestie voice calls are ON by default for every woman — a male match can
		// always call her AI bestie without her having to opt in. Only block a
		// non-woman owner (men have no bestie voice) or a woman who has explicitly
		// opted out (calls_opt_in === false).
		if (ownerUser.gender !== 'woman') {
			return json(
				{ error: 'not_enabled', message: `${ownerUser.first_name} isn't taking AI calls.` },
				{ status: 403 }
			);
		}
		if (profile?.calls_opt_in === false) {
			return json(
				{ error: 'not_enabled', message: `${ownerUser.first_name}'s bestie isn't taking calls right now.` },
				{ status: 403 }
			);
		}

		// Guard against a second concurrent live/ringing call on this match.
		const { data: existing } = await (supabase as any)
			.from('vv_voice_calls')
			.select('id')
			.eq('match_id', body.matchId)
			.in('status', ['ringing', 'live'])
			.maybeSingle();
		if (existing) {
			return json({ error: 'call_in_progress', message: 'A call is already in progress.' }, { status: 409 });
		}

		const { voiceId, usingClonedVoice } = resolveVoice(profile);
		const room = `vv-voice-${crypto.randomUUID()}`;

		const { data: callRow, error: insErr } = await (supabase as any)
			.from('vv_voice_calls')
			.insert({
				match_id: body.matchId,
				owner_user_id: ownerId,
				caller_user_id: caller.id,
				channel: 'webrtc',
				status: 'ringing',
				livekit_room: room,
				voice_id_used: voiceId,
				used_cloned_voice: usingClonedVoice,
				caller_consent_at: new Date().toISOString()
			})
			.select('id')
			.single();
		if (insErr || !callRow) {
			console.error('[voice/start] insert failed:', insErr);
			return json({ error: 'Failed to create call' }, { status: 500 });
		}

		const token = await mintJoinToken({
			room,
			identity: `caller-${caller.id}`,
			name: 'caller',
			ttlSeconds: 180
		});

		// Tell the always-on agent worker to join. Non-fatal if dispatch lags; the
		// worker can also auto-join the room by metadata.
		await dispatchVoiceAgent(room, callRow.id).catch((e) =>
			console.error('[voice/start] dispatch failed (non-fatal):', e)
		);

		return json({
			callId: callRow.id,
			room,
			token,
			wsUrl: livekitWsUrl(),
			ownerName: ownerUser.first_name
		});
	} catch (error) {
		console.error('[voice/start] error:', error);
		return json(
			{ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
			{ status: 500 }
		);
	}
};
