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
import {
	cli,
	defineAgent,
	voice,
	llm,
	ServerOptions,
	DEFAULT_API_CONNECT_OPTIONS,
	type JobContext
} from '@livekit/agents';
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
 * Claude as a first-class LLM for the voice pipeline.
 *
 * LiveKit's JS Agents has no Anthropic plugin. Overriding `Agent.llmNode` is NOT
 * enough: AgentActivity only runs the LLM step when an `llm` is configured on the
 * session/agent — otherwise a completed user turn just returns with no reply
 * (agent_activity.js: `else if (this.llm === void 0) return`). So we implement a
 * real `llm.LLM` + `llm.LLMStream` backed by the Anthropic SDK and pass it as the
 * session's `llm`. The greeting still uses `session.say()`; every turn after that
 * flows STT -> this LLM -> TTS.
 */
class ClaudeLLMStream extends llm.LLMStream {
	private readonly modelId: string;
	private readonly systemPrompt: string;
	private readonly fallbackText: string;
	private readonly onError?: (err: unknown) => void;

	constructor(
		llmInstance: ClaudeLLM,
		opts: { chatCtx: any; toolCtx?: any; connOptions: any },
		systemPrompt: string,
		modelId: string,
		fallbackText: string,
		onError?: (err: unknown) => void
	) {
		super(llmInstance, opts);
		this.systemPrompt = systemPrompt;
		this.modelId = modelId;
		this.fallbackText = fallbackText;
		this.onError = onError;
	}

	protected async run(): Promise<void> {
		// Build the Anthropic system + messages from the live chat context. The
		// agent instructions arrive as system items; the conversation as
		// user/assistant items. Anthropic requires the first message to be a user
		// turn, so drop leading assistant turns.
		const sys: string[] = [];
		const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
		for (const item of (this.chatCtx as any).items ?? []) {
			const role = (item as any)?.role;
			const text = (item as any)?.textContent;
			if (typeof text !== 'string' || !text.trim()) continue;
			if (role === 'system') sys.push(text.trim());
			else if (role === 'user' || role === 'assistant') messages.push({ role, content: text.trim() });
		}
		while (messages.length && messages[0].role === 'assistant') messages.shift();
		if (messages.length === 0) messages.push({ role: 'user', content: '(the caller is quiet)' });
		const system = sys.join('\n\n') || this.systemPrompt;

		try {
			const stream = anthropic.messages.stream({
				model: this.modelId,
				max_tokens: 300,
				system,
				messages
			});
			for await (const ev of stream) {
				if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
					// Base class pipes this.queue -> output and closes the queue when
					// run() resolves, so we only enqueue deltas here.
					this.queue.put({
						id: crypto.randomUUID(),
						delta: { role: 'assistant', content: ev.delta.text }
					});
				}
			}
		} catch (err) {
			// The brain (Anthropic) failed mid-call — e.g. out of credit, rate limit,
			// network. Without this, the caller hears dead air and keeps saying
			// "hello? can you hear me?" (the original silent-call bug). Instead, speak
			// a graceful fallback so they hear SOMETHING, then let onError wind the
			// call down. Enqueuing here works because run() hasn't resolved yet, so the
			// base class hasn't closed the queue.
			console.error('[ClaudeLLM] generation failed — speaking fallback then ending', err);
			this.queue.put({
				id: crypto.randomUUID(),
				delta: { role: 'assistant', content: this.fallbackText }
			});
			this.onError?.(err);
		}
	}
}

class ClaudeLLM extends llm.LLM {
	private readonly modelId: string;
	private readonly systemPrompt: string;
	private readonly fallbackText: string;
	private readonly onError?: (err: unknown) => void;

	constructor(opts: {
		model: string;
		system: string;
		fallbackText: string;
		onError?: (err: unknown) => void;
	}) {
		super();
		this.modelId = opts.model;
		this.systemPrompt = opts.system;
		this.fallbackText = opts.fallbackText;
		this.onError = opts.onError;
	}

	label(): string {
		return 'anthropic.ClaudeLLM';
	}
	override get model(): string {
		return this.modelId;
	}

	chat({ chatCtx, toolCtx, connOptions }: any): llm.LLMStream {
		return new ClaudeLLMStream(
			this,
			{ chatCtx, toolCtx, connOptions: connOptions ?? DEFAULT_API_CONNECT_OPTIONS },
			this.systemPrompt,
			this.modelId,
			this.fallbackText,
			this.onError
		);
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
		// Set when the brain (Anthropic) fails mid-call. A call that died this way is
		// never a clean 'completed' even though the transcript has the greeting +
		// fallback line.
		let llmFatal = false;

		// Derive the call's true outcome from what actually happened, so a one-sided
		// call (greeting played, caller talked, but the agent never really engaged —
		// the original silent-call bug) is no longer mislabelled 'completed'. A real
		// conversation needs at least one agent reply BEYOND the opening greeting.
		const computeStatus = (): 'completed' | 'partial' | 'failed' => {
			const agentTurns = transcript.filter((t) => t.role === 'agent').length;
			const callerTurns = transcript.filter((t) => t.role === 'caller').length;
			if (llmFatal) return callerTurns > 0 ? 'partial' : 'failed';
			// agentTurns <= 1 means only the greeting was ever spoken.
			if (agentTurns <= 1) return callerTurns > 0 ? 'partial' : 'failed';
			return 'completed';
		};

		const doFinalize = async (statusOverride?: 'completed' | 'partial' | 'failed') => {
			if (finalized) return;
			finalized = true;
			const durationS = Math.round((Date.now() - startedAt) / 1000);
			await finalize(callId, transcript, durationS, statusOverride ?? computeStatus());
		};

		// Everything below can throw (plugin construction, session start). Because
		// /context already flipped the call to 'live', any crash here must finalize
		// the call as failed — otherwise it sticks in 'live' and blocks the match.
		try {
		const session = new voice.AgentSession({
			vad: (ctx.proc.userData as any).vad as silero.VAD,
			// Pass keys explicitly — the plugins look for ELEVEN_API_KEY /
			// DEEPGRAM_API_KEY env names, but we standardise on ELEVENLABS_API_KEY.
			stt: new deepgram.STT({
				model: 'nova-2-general',
				language: 'en-IN',
				apiKey: process.env.DEEPGRAM_API_KEY
			}),
			// Claude as the brain — required as a real `llm` or the pipeline never
			// generates replies (only the greeting say() would be heard). If the brain
			// errors mid-call it speaks `fallbackText` then onError winds the call down,
			// so the caller never hears dead air.
			llm: new ClaudeLLM({
				model: CLAUDE_MODEL,
				system: cfg.systemPrompt,
				fallbackText: `I'm so sorry, ${cfg.matchName} — I'm having a technical issue on my end and can't keep chatting right now. I'll let ${cfg.ownerName} know you called, and she'll reach out. Take care!`,
				onError: () => {
					if (llmFatal) return;
					llmFatal = true;
					// Give TTS a few seconds to speak the fallback line, then end the
					// call gracefully. doFinalize/Close are idempotent.
					setTimeout(() => {
						void (async () => {
							await doFinalize();
							await ctx.room.disconnect().catch(() => undefined);
						})();
					}, 7000);
				}
			}),
			tts: new elevenlabs.TTS({
				voiceId: cfg.voiceId,
				apiKey: process.env.ELEVENLABS_API_KEY
			})
		});

		const agent = new voice.Agent({ instructions: cfg.systemPrompt });

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
			void doFinalize();
		});
		// Surface pipeline errors (STT/LLM/TTS) so they show up in fly logs.
		session.on(voice.AgentSessionEventTypes.Error, (ev: any) => {
			console.error('[session] error', JSON.stringify(ev?.error ?? ev));
		});

		// Fallback: caller leaves / room ends.
		ctx.room.on('disconnected' as any, () => {
			void doFinalize();
		});
		ctx.room.on('participantDisconnected' as any, () => {
			const humans = Array.from(ctx.room.remoteParticipants.values()).filter(
				(p: any) => !String(p.identity).startsWith('agent')
			);
			if (humans.length === 0) void doFinalize();
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
				await doFinalize();
				await ctx.room.disconnect().catch(() => undefined);
			})();
		}, MAX_CALL_SECONDS * 1000);

		ctx.addShutdownCallback(async () => {
			clearTimeout(capTimer);
			await doFinalize();
		});

		await session.start({ agent, room: ctx.room });

		// Make sure the caller is actually in the room (and our audio path to them
		// is up) BEFORE we greet. Otherwise the opening line is spoken into an
		// empty room and the caller hears nothing until they say "hello?" — the
		// "bestie didn't greet me" bug. waitForParticipant resolves as soon as a
		// remote (human) participant is present; we cap the wait so a no-show
		// caller can't hang the entry forever.
		try {
			await Promise.race([
				ctx.waitForParticipant(),
				new Promise((resolve) => setTimeout(resolve, 8000))
			]);
		} catch (e) {
			console.error('[agent] waitForParticipant failed; greeting anyway', e);
		}

		// Disclosure preamble + warm opener. The ConversationItemAdded handler
		// captures this into the transcript, so don't push it manually (that caused
		// the greeting to appear twice).
		await session.say(cfg.greeting);
		} catch (err) {
			console.error('[agent] entry failed after call went live — finalizing as failed', err);
			await doFinalize('failed');
			await ctx.room.disconnect().catch(() => undefined);
		}
	}
});

cli.runApp(
	new ServerOptions({
		agent: import.meta.filename,
		// Must match LIVEKIT_AGENT_NAME used by the app's dispatch call.
		agentName: process.env.LIVEKIT_AGENT_NAME ?? 'bestie-voice'
	})
);
