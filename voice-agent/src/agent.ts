/**
 * Verified Vibe — AI Bestie voice-call agent worker.
 *
 * Runs OFF Vercel (always-on, e.g. Fly.io). Joins the LiveKit room the web
 * client created, then runs the assembled voice pipeline:
 *
 *     Silero VAD (turn-taking)
 *       -> Deepgram STT (en-IN)
 *         -> Claude (the SAME bestie brain — system prompt is fetched from the
 *            app's /api/voice/calls/:id/context so behaviour can't drift)
 *           -> ElevenLabs TTS (her cloned voice, or the default premium voice)
 *
 * The bestie's "features" are exposed as tools (save_preference / draft_message /
 * lookup_match_fact) that call back into the app — so nothing is ever spoken as a
 * control token. When the call ends (graceful wrap, max-duration cap, or the
 * caller leaving) we POST the transcript to /finalize, which summarises it into a
 * message in the chat thread.
 *
 * NOTE: the @livekit/agents JS API is young and version-sensitive. This file
 * targets the 0.7.x `voice` API. If you pin a different version, reconcile the
 * session/event names against that version's docs — the SHAPE here (fetch
 * context -> start session -> capture transcript -> finalize) stays the same.
 */
import {
	type JobContext,
	WorkerOptions,
	cli,
	defineAgent,
	voice,
	llm
} from '@livekit/agents';
import * as anthropic from '@livekit/agents-plugin-anthropic';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as elevenlabs from '@livekit/agents-plugin-elevenlabs';
import * as silero from '@livekit/agents-plugin-silero';
import { z } from 'zod';
import 'dotenv/config';

const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';
const WORKER_SECRET = process.env.VOICE_WORKER_SECRET ?? '';
// Hard ceiling on call length (phase 1). Length should follow the conversation
// winding down, but this guarantees cost + UX never run away.
const MAX_CALL_SECONDS = Number(process.env.MAX_CALL_SECONDS ?? 360);

interface CallContext {
	callId: string;
	ownerName: string;
	matchName: string;
	systemPrompt: string;
	voiceId: string;
	usingClonedVoice: boolean;
	greeting: string;
}

type Turn = { role: 'agent' | 'caller'; text: string; ts: string };

function appHeaders() {
	return { 'content-type': 'application/json', 'x-voice-worker-secret': WORKER_SECRET };
}

async function fetchCallContext(callId: string): Promise<CallContext> {
	const res = await fetch(`${APP_URL}/api/voice/calls/${callId}/context`, {
		headers: { 'x-voice-worker-secret': WORKER_SECRET }
	});
	if (!res.ok) throw new Error(`context fetch failed: ${res.status} ${await res.text()}`);
	return (await res.json()) as CallContext;
}

async function callTool(callId: string, tool: string, args: Record<string, unknown>) {
	try {
		const res = await fetch(`${APP_URL}/api/voice/tools`, {
			method: 'POST',
			headers: appHeaders(),
			body: JSON.stringify({ callId, tool, args })
		});
		return await res.json();
	} catch (e) {
		console.error(`[tool ${tool}] failed`, e);
		return { ok: false };
	}
}

async function finalize(
	callId: string,
	transcript: Turn[],
	durationS: number,
	status: 'completed' | 'partial' | 'failed' | 'no_answer'
) {
	try {
		await fetch(`${APP_URL}/api/voice/calls/${callId}/finalize`, {
			method: 'POST',
			headers: appHeaders(),
			body: JSON.stringify({ transcript, durationS, status })
		});
	} catch (e) {
		console.error('[finalize] failed', e);
	}
}

export default defineAgent({
	/** Pre-warm the VAD model once per worker process. */
	prewarm: async (proc) => {
		proc.userData.vad = await silero.VAD.load();
	},

	entry: async (ctx: JobContext) => {
		await ctx.connect();

		// The app puts the callId in room metadata (and dispatch metadata).
		let callId = '';
		try {
			callId = JSON.parse(ctx.room.metadata || '{}').callId ?? '';
		} catch {
			/* ignore */
		}
		if (!callId) {
			console.error('[agent] no callId in room metadata; leaving');
			return;
		}

		const cfg = await fetchCallContext(callId);
		const transcript: Turn[] = [];
		const startedAt = Date.now();
		let finalized = false;

		const doFinalize = async (status: 'completed' | 'partial' | 'failed') => {
			if (finalized) return;
			finalized = true;
			const durationS = Math.round((Date.now() - startedAt) / 1000);
			await finalize(callId, transcript, durationS, status);
		};

		// ── Tools = the bestie's features, callable silently ────────────────────
		const tools = {
			save_preference: llm.tool({
				description:
					"Record a genuine preference, boundary, or dealbreaker the owner has, revealed during the call. Never announce this.",
				parameters: z.object({
					type: z.enum(['dealbreaker', 'boundary', 'signal', 'note']),
					value: z.string().describe('Concise description, max ~80 chars')
				}),
				execute: async ({ type, value }) => {
					await callTool(callId, 'save_preference', { type, value });
					return 'saved';
				}
			}),
			draft_message: llm.tool({
				description:
					'Leave the owner a ready-to-send reply for something concrete she should follow up on. Only for real follow-ups, not filler. Never announce this.',
				parameters: z.object({ text: z.string() }),
				execute: async ({ text }) => {
					await callTool(callId, 'draft_message', { text });
					return 'drafted';
				}
			}),
			lookup_match_fact: llm.tool({
				description:
					'Look up real grounding facts about the owner or the match (preferences, what she is looking for, his verified proofs) instead of guessing.',
				parameters: z.object({ query: z.string() }),
				execute: async ({ query }) => {
					const r = await callTool(callId, 'lookup_match_fact', { query });
					return JSON.stringify((r as any)?.facts ?? {});
				}
			})
		};

		const session = new voice.AgentSession({
			vad: ctx.proc.userData.vad as silero.VAD,
			stt: new deepgram.STT({ model: 'nova-2-general', language: 'en-IN' }),
			llm: new anthropic.LLM({ model: 'claude-sonnet-4-5-20250929', temperature: 0.7 }),
			tts: new elevenlabs.TTS({ voiceId: cfg.voiceId })
		});

		const agent = new voice.Agent({ instructions: cfg.systemPrompt, tools });

		// Capture both sides of the conversation for the post-call summary.
		session.on('conversation_item_added', (ev: any) => {
			const item = ev?.item ?? ev;
			const role = item?.role === 'assistant' ? 'agent' : 'caller';
			const text = (item?.textContent ?? item?.content ?? '').toString().trim();
			if (text) transcript.push({ role, text, ts: new Date().toISOString() });
		});

		// Caller hangs up / leaves → wrap with whatever we have.
		ctx.room.on('disconnected', () => {
			void doFinalize(transcript.length ? 'completed' : 'failed');
		});
		ctx.room.on('participantDisconnected', () => {
			// If the only human leaves, end the call.
			const humans = Array.from(ctx.room.remoteParticipants.values()).filter(
				(p: any) => !String(p.identity).startsWith('agent')
			);
			if (humans.length === 0) void doFinalize(transcript.length ? 'completed' : 'failed');
		});

		// Hard max-duration cap.
		const capTimer = setTimeout(() => {
			void (async () => {
				try {
					await session.say(
						`I should let you go — this has been lovely. I'll pass everything along to ${cfg.ownerName}, and she'll reach out if she'd like to keep chatting. Take care!`
					);
				} catch {
					/* ignore */
				}
				await doFinalize(transcript.length ? 'completed' : 'partial');
				await ctx.room.disconnect().catch(() => undefined);
			})();
		}, MAX_CALL_SECONDS * 1000);

		await session.start({ agent, room: ctx.room });

		// Disclosure preamble + warm opener (counts as the first agent turn).
		transcript.push({ role: 'agent', text: cfg.greeting, ts: new Date().toISOString() });
		await session.say(cfg.greeting);

		// Keep the job alive until the room ends; cleanup the timer afterwards.
		ctx.addShutdownCallback(async () => {
			clearTimeout(capTimer);
			await doFinalize(transcript.length ? 'completed' : 'failed');
		});
	}
});

cli.runApp(
	new WorkerOptions({
		agent: new URL(import.meta.url).pathname,
		// Must match LIVEKIT_AGENT_NAME used by the app's dispatch call.
		agentName: process.env.LIVEKIT_AGENT_NAME ?? 'bestie-voice'
	})
);
