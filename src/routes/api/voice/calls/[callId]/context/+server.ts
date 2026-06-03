import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import { verifyWorkerSecret } from '$lib/server/voice-auth';
import { loadVoiceCallContext } from '$lib/server/voice-call-context';

/**
 * GET /api/voice/calls/:callId/context  (worker-only)
 *
 * The bestie voice agent calls this on join to fetch its fully-assembled spoken
 * system prompt + the voice to speak in, and we mark the call live. Gated by the
 * shared worker secret (the worker has no Supabase user session).
 */
export const GET: RequestHandler = async ({ request, params }) => {
	if (!verifyWorkerSecret(request)) return json({ error: 'Unauthorized' }, { status: 401 });

	const callId = params.callId!;
	const supabase = getSupabase();

	const { data: call } = await (supabase as any)
		.from('vv_voice_calls')
		.select('id, match_id, owner_user_id, status, voice_id_used, used_cloned_voice')
		.eq('id', callId)
		.single();
	if (!call) return json({ error: 'Call not found' }, { status: 404 });
	if (call.status === 'completed' || call.status === 'cancelled') {
		return json({ error: 'Call already ended' }, { status: 409 });
	}

	const ctx = await loadVoiceCallContext(call.owner_user_id, call.match_id, call.used_cloned_voice);

	// Mark live on first context fetch.
	if (call.status === 'ringing') {
		await (supabase as any)
			.from('vv_voice_calls')
			.update({ status: 'live', connected_at: new Date().toISOString() })
			.eq('id', callId);
	}

	return json({
		callId,
		ownerName: ctx.ownerName,
		matchName: ctx.matchName,
		systemPrompt: ctx.systemPrompt,
		voiceId: call.voice_id_used,
		usingClonedVoice: call.used_cloned_voice,
		greeting: `Hi ${ctx.matchName}! This is ${ctx.ownerName}'s AI bestie. Just so you know, I'm an AI, and this call may be recorded — ${ctx.ownerName} asked me to get to know you a little before she jumps in. How are you doing?`
	});
};
