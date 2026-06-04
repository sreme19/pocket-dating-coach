/**
 * Verified Vibe — AI Bestie voice-call agent worker.
 *
 * Runs OFF Vercel (always-on, e.g. Fly.io). Joins the LiveKit room the web
 * client created, then runs the assembled voice pipeline:
 *
 *     Silero VAD (turn-taking)
 *       -> Deepgram STT (en-IN)
 *         -> Claude (the SAME bestie brain — system prompt fetched from the app's
 *            /api/voice/calls/:id/context so behaviour can't drift)
 *           -> ElevenLabs TTS (her cloned voice, or the default premium voice)
 *
 * LiveKit's JS Agents framework has no Anthropic LLM plugin, so we keep Claude as
 * the brain by subclassing voice.Agent and overriding `llmNode` to stream the
 * Anthropic SDK directly. When the call ends we POST the transcript to the app's
 * /finalize endpoint, which summarises it into a recap message in the thread.
 *
 * Targets @livekit/agents 1.4.x.
 */
import { cli, defineAgent, voice, ServerOptions, type JobContext } from '@livekit/agents';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as elevenlabs from '@livekit/agents-plugin-elevenlabs';
import * as silero from '@livekit/agents-plugin-silero';
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';
const WORKER_SECRET = process.env.VOICE_WORKER_SECRET ?? '';
const CLAUDE_MODEL = 'claude-sonnet-4-5-20250929';
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

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function workerHeaders() {
	return { 'content-type': 'application/json', 'x-voice-worker-secret': WORKER_SECRET };
}

async function fetchCallContext(callId: string): Promise<CallContext> {
	const res = await fetch(`${APP_URL}/api/voice/calls/${callId}/context`, {
		headers: { 'x-voice-worker-secret': WORKER_SECRET }
	});
	if (!res.ok) throw new Error(`context fetch failed: ${res.status} ${await res.text()}`);
	return (await res.json()) as CallContext;
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
			headers: workerHeaders(),
			body: JSON.stringify({ transcript, durationS, status })
		});
	} catch (e) {
		console.error('[finalize] failed', e);
	}
}

/**
 * Bestie agent — overrides the LLM node to stream Claude. The system prompt is
 * supplied by the app (full feature parity with the text bestie); we only build
 * the running message history from the live chat context.
 */
class BestieAgent extends voice.Agent {
	private readonly sys: string;

	constructor(systemPrompt: string) {
		super({ instructions: systemPrompt });
		this.sys = systemPrompt;
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	override async llmNode(chatCtx: any, _toolCtx: any, _modelSettings: any) {
		// Convert the live chat context into Anthropic messages. Anthropic requires
		// the first message to be a user turn, so drop any leading assistant turns
		// (e.g. our spoken greeting — it lives in the transcript regardless).
		const msgs: Array<{ role: 'user' | 'assistant'; content: string }> = [];
		for (const item of chatCtx.items ?? []) {
			const role = (item as any).role;
			const text = (item as any).textContent;
			if ((role === 'user' || role === 'assistant') && typeof text === 'string' && text.trim()) {
				msgs.push({ role, content: text.trim() });
			}
		}
		while (msgs.length && msgs[0].role === 'assistant') msgs.shift();
		if (msgs.length === 0) msgs.push({ role: 'user', content: '(call connected)' });

		const sys = this.sys;
		return new ReadableStream<string>({
			async start(controller) {
				try {
					const stream = anthropic.messages.stream({
						model: CLAUDE_MODEL,
						max_tokens: 400,
						system: sys,
						messages: msgs
					});
					for await (const ev of stream) {
						if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
							controller.enqueue(ev.delta.text);
						}
					}
				} catch (e) {
					console.error('[llmNode] Claude stream failed', e);
				} finally {
					controller.close();
				}
			}
		});
	}
}

export default defineAgent({
	/** Load the VAD model once per worker process. */
	prewarm: async (proc) => {
		(proc.userData as any).vad = await silero.VAD.load();
	},

	entry: async (ctx: JobContext) => {
		await ctx.connect();

		// callId is passed via the dispatch/job metadata by /api/voice/calls/start.
		let callId = '';
		try {
			callId = JSON.parse(ctx.job?.metadata || '{}').callId ?? '';
		} catch {
			/* ignore */
		}
		if (!callId) {
			try {
				callId = JSON.parse((ctx.room as any)?.metadata || '{}').callId ?? '';
			} catch {
				/* ignore */
			}
		}
		if (!callId) {
			console.error('[agent] no callId in job/room metadata; leaving');
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

		const session = new voice.AgentSession({
			vad: (ctx.proc.userData as any).vad as silero.VAD,
			stt: new deepgram.STT({ model: 'nova-2-general', language: 'en-IN' }),
			tts: new elevenlabs.TTS({ voiceId: cfg.voiceId })
		});

		const agent = new BestieAgent(cfg.systemPrompt);

		// Capture both sides of the conversation for the post-call summary.
		session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (ev: any) => {
			const item = ev?.item ?? ev;
			const role = (item as any)?.role === 'assistant' ? 'agent' : 'caller';
			const text = ((item as any)?.textContent ?? '').toString().trim();
			if (text) transcript.push({ role, text, ts: new Date().toISOString() });
		});

		// AUTHORITATIVE end-of-call signal: the session's own Close event fires
		// whenever the session ends (caller hangs up, room closes, shutdown). This
		// is what reliably finalises the call so it never sticks in 'live'.
		session.on(voice.AgentSessionEventTypes.Close, (ev: any) => {
			console.log('[session] close', ev?.reason ?? '');
			void doFinalize(transcript.length ? 'completed' : 'failed');
		});
		// Surface pipeline errors (STT/LLM/TTS) so they show up in fly logs.
		session.on(voice.AgentSessionEventTypes.Error, (ev: any) => {
			console.error('[session] error', JSON.stringify(ev?.error ?? ev));
		});

		// Fallback: caller leaves / room ends.
		ctx.room.on('disconnected' as any, () => {
			void doFinalize(transcript.length ? 'completed' : 'failed');
		});
		ctx.room.on('participantDisconnected' as any, () => {
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

		ctx.addShutdownCallback(async () => {
			clearTimeout(capTimer);
			await doFinalize(transcript.length ? 'completed' : 'failed');
		});

		await session.start({ agent, room: ctx.room });

		// Disclosure preamble + warm opener.
		transcript.push({ role: 'agent', text: cfg.greeting, ts: new Date().toISOString() });
		await session.say(cfg.greeting);
	}
});

cli.runApp(
	new ServerOptions({
		agent: import.meta.filename,
		// Must match LIVEKIT_AGENT_NAME used by the app's dispatch call.
		agentName: process.env.LIVEKIT_AGENT_NAME ?? 'bestie-voice'
	})
);
