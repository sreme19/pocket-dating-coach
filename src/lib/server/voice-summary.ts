// ============================================================
// voice-summary.ts — turns a finished voice-call transcript into a bestie
// message dropped back into the match thread, exactly like the text bestie's
// coaching pattern (public recap as the message body; private signal + read in
// ai_signal/ai_read for the owner's eyes only).
//
// Called by POST /api/voice/calls/[id]/finalize after the worker posts the
// transcript. Also records latency to vv_ai_response_timings (response_type =
// 'voice_summary') so it shows up in the existing AI Latency dashboard.
// ============================================================

import { getClaudeClient, CLAUDE_MODEL } from '$lib/claude';
import { getSupabase } from './supabase';

export interface VoiceTranscriptTurn {
	role: 'agent' | 'caller';
	text: string;
	ts?: string;
}

export interface VoiceSummary {
	/** Public message the bestie posts into the thread (both parties can see). */
	recap: string;
	/** ✅ | ⚠️ | 🚩 — same scale as the text bestie. */
	signal: string;
	/** Private one/two-liner for the owner only. */
	read: string;
}

function buildVoiceSummaryPrompt(opts: {
	ownerName: string;
	matchName: string;
	transcript: string;
	partial: boolean;
}): string {
	const { ownerName, matchName, transcript, partial } = opts;
	return `You are ${ownerName}'s AI Bestie. You just got off a ${partial ? 'partial (the call dropped early) ' : ''}voice call with her match ${matchName}, where you got to know him on her behalf. Now write the recap that goes back into their chat thread.

HARD RULES:
- You are the bestie, never ${ownerName}. Refer to her in the third person by name. Speak in your own warm voice.
- The "recap" is visible to ${matchName} too, so keep it warm, gracious, and natural — never clinical, never a data dump, never list private concerns there.
- The "read" is for ${ownerName}'s eyes only — be honest and specific there: what was genuinely good, and any real concern measured against what she's looking for. Most calls are fine; don't manufacture drama.

CALL TRANSCRIPT (agent = you, caller = ${matchName}):
${transcript}

Return ONLY this JSON (no markdown fence):
{
  "recap": "2-4 warm spoken-style sentences to post in the thread: thank ${matchName} for the call, mention one genuine thing that stood out, and say you'll pass it along to ${ownerName} and she'll reach out if she wants to keep talking.",
  "signal": "✅ | ⚠️ | 🚩",
  "read": "1-2 sentences for ${ownerName} only — the honest private read on ${matchName} from this call, fair and balanced."
}`;
}

/** Summarise a transcript into recap + signal + read. */
export async function summariseVoiceCall(opts: {
	ownerName: string;
	matchName: string;
	transcript: VoiceTranscriptTurn[];
	partial: boolean;
}): Promise<VoiceSummary> {
	const transcriptText = opts.transcript
		.map((t) => `${t.role === 'agent' ? 'agent' : 'caller'}: ${t.text}`)
		.join('\n')
		.slice(0, 12000);

	const client = getClaudeClient();
	const message = await client.messages.create({
		model: CLAUDE_MODEL,
		max_tokens: 500,
		messages: [
			{
				role: 'user',
				content: buildVoiceSummaryPrompt({
					ownerName: opts.ownerName,
					matchName: opts.matchName,
					transcript: transcriptText,
					partial: opts.partial
				})
			}
		]
	});
	const block = message.content[0];
	if (block.type !== 'text') throw new Error('Unexpected response type from Claude');
	const raw = block.text.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
	const parsed = JSON.parse(raw) as VoiceSummary;
	return {
		recap: parsed.recap?.trim() || `Thanks for the call! I'll pass everything along to ${opts.ownerName}.`,
		signal: parsed.signal?.trim() || '✅',
		read: parsed.read?.trim() || ''
	};
}

/**
 * Finalise a call: summarise, post the bestie recap message into the thread, and
 * record latency. Returns the inserted message id. Idempotent guard is the
 * caller's responsibility (it checks the call isn't already completed).
 */
export async function finaliseVoiceCall(opts: {
	callId: string;
	matchId: string;
	ownerId: string;
	ownerName: string;
	matchName: string;
	transcript: VoiceTranscriptTurn[];
	partial: boolean;
	startedAt?: string | null;
}): Promise<{ messageId: string | null; summary: VoiceSummary }> {
	const supabase = getSupabase();
	const t0 = Date.now();
	const summary = await summariseVoiceCall({
		ownerName: opts.ownerName,
		matchName: opts.matchName,
		transcript: opts.transcript,
		partial: opts.partial
	});
	const claudeMs = Date.now() - t0;

	// Post the recap as a bestie message in the thread (is_ai = true, sent from
	// the owner like every other bestie message). Private read/signal ride along.
	const { data: inserted } = await (supabase as any)
		.from('verified_vibe_messages')
		.insert({
			match_id: opts.matchId,
			sender_id: opts.ownerId,
			content: summary.recap,
			is_ai: true,
			ai_signal: summary.signal,
			ai_read: summary.read
		})
		.select('id, created_at')
		.single();

	const messageId: string | null = inserted?.id ?? null;

	// Record latency for the AI Latency dashboard (non-fatal).
	if (messageId) {
		try {
			await (supabase as any)
				.from('vv_ai_response_timings')
				.upsert(
					{
						reply_message_id: messageId,
						match_id: opts.matchId,
						response_type: 'voice_summary',
						generated_at: inserted?.created_at ?? null,
						generation_ms: Date.now() - t0,
						claude_ms: claudeMs
					},
					{ onConflict: 'reply_message_id' }
				);
		} catch (e) {
			console.error('[voice-summary] timing record failed (non-fatal):', e);
		}
	}

	return { messageId, summary };
}
