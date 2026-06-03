import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import { verifyWorkerSecret } from '$lib/server/voice-auth';
import { finaliseVoiceCall } from '$lib/server/voice-summary';
import type { VoiceTranscriptTurn } from '$lib/server/voice-summary';

/**
 * POST /api/voice/calls/:callId/finalize  (worker-only)
 *
 * The worker posts this when the call ends (graceful hangup, max-duration cap,
 * or drop). We persist the transcript, summarise it into a bestie message in the
 * thread, and close the call record. Idempotent: a second call after completion
 * is a no-op.
 *
 * Body: {
 *   transcript: { role:'agent'|'caller', text, ts? }[]
 *   durationS?: number
 *   status?: 'completed' | 'partial' | 'no_answer' | 'failed'
 *   failureReason?: string
 * }
 */
export const POST: RequestHandler = async ({ request, params }) => {
	if (!verifyWorkerSecret(request)) return json({ error: 'Unauthorized' }, { status: 401 });

	const callId = params.callId!;
	const supabase = getSupabase();

	const body = (await request.json()) as {
		transcript?: VoiceTranscriptTurn[];
		durationS?: number;
		status?: 'completed' | 'partial' | 'no_answer' | 'failed';
		failureReason?: string;
	};

	const { data: call } = await (supabase as any)
		.from('vv_voice_calls')
		.select('id, match_id, owner_user_id, caller_user_id, status, started_at, summary_message_id')
		.eq('id', callId)
		.single();
	if (!call) return json({ error: 'Call not found' }, { status: 404 });

	// Idempotency: already finalised.
	if (call.status === 'completed' || call.status === 'partial' || call.status === 'failed') {
		return json({ ok: true, alreadyFinalised: true, messageId: call.summary_message_id });
	}

	const transcript = Array.isArray(body.transcript) ? body.transcript : [];
	const hasContent = transcript.some((t) => t?.text?.trim());
	const incomingStatus = body.status ?? (hasContent ? 'completed' : 'no_answer');

	// Resolve owner + match first names for the summariser.
	const ownerId: string = call.owner_user_id;
	const callerId: string = call.caller_user_id;
	const [{ data: ownerUser }, { data: callerUser }] = await Promise.all([
		supabase.from('verified_vibe_users').select('first_name').eq('id', ownerId).single(),
		supabase.from('verified_vibe_users').select('first_name').eq('id', callerId).single()
	]);
	const ownerName = (ownerUser as any)?.first_name || 'her';
	const matchName = (callerUser as any)?.first_name || 'him';

	let summaryMessageId: string | null = null;
	let finalStatus = incomingStatus;

	if (hasContent && (incomingStatus === 'completed' || incomingStatus === 'partial')) {
		try {
			const result = await finaliseVoiceCall({
				callId,
				matchId: call.match_id,
				ownerId,
				ownerName,
				matchName,
				transcript,
				partial: incomingStatus === 'partial',
				startedAt: call.started_at
			});
			summaryMessageId = result.messageId;
		} catch (e) {
			console.error('[voice/finalize] summary failed:', e);
			finalStatus = 'failed';
		}
	}

	await (supabase as any)
		.from('vv_voice_calls')
		.update({
			status: finalStatus,
			transcript,
			duration_s: body.durationS ?? null,
			ended_at: new Date().toISOString(),
			summary_message_id: summaryMessageId,
			failure_reason: body.failureReason ?? null
		})
		.eq('id', callId);

	return json({ ok: true, status: finalStatus, messageId: summaryMessageId });
};
