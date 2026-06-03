# Voice AI — AI Bestie live voice calls

Turns the text bestie chat into a live phone-style call. A male match taps
"Talk to her AI bestie", has a real-time voice conversation with the female
owner's AI bestie (her cloned voice if she opted in, otherwise a premium default
voice), and when the call ends the bestie drops a recap back into the same chat
thread. The bestie keeps all its features — they're exposed as call tools.

Branch: `voiceAI`. Decisions locked with the product owner:
in-app WebRTC first (PSTN later) · opt-in real-voice clone with AI fallback ·
male-initiated ("Get a call now") · assembled open stack (LiveKit + Deepgram +
Claude + ElevenLabs).

## Architecture

```
  Male's browser (VoiceCall.svelte, livekit-client)
        │  POST /api/voice/calls/start   ── mint token, create room+call row, dispatch agent
        ▼
  LiveKit room (media plane, off-Vercel)
        ▲
        │  joins as "bestie-voice" agent
  voice-agent/  (always-on worker, e.g. Fly.io — NOT Vercel)
     Silero VAD → Deepgram STT (en-IN) → Claude → ElevenLabs TTS
        │  GET  /api/voice/calls/:id/context   ── fetch the shared bestie system prompt + voice
        │  POST /api/voice/tools               ── save_preference / draft_message / lookup_match_fact
        │  POST /api/voice/calls/:id/finalize  ── transcript → summary → message in thread
        ▼
  Supabase (vv_voice_profiles, vv_voice_calls, verified_vibe_messages)
```

Vercel never holds the live media — it can't run a multi-minute audio session.
It only sets up, authorizes, and finalizes. The worker owns the call.

## Why the brain can't drift

The worker fetches its system prompt from the app at call start
(`/api/voice/calls/:id/context`), assembled by `src/lib/server/voice-call-context.ts`
→ `buildBestieVoiceSystemPrompt` in `src/lib/prompts.ts`. That reuses the SAME
preferences / verified-proofs / thread-history grounding as the text bestie, so
the voice and text personas can't diverge. The text bestie's in-band markers
(`[PREF]`, `[DRAFT]`) become tools so the agent never speaks a control token.

## Files

App (SvelteKit / Vercel):
- `supabase/migrations/20260603174904_voice_ai_bestie_calls.sql` — `vv_voice_profiles`, `vv_voice_calls`
- `src/lib/prompts.ts` — `buildBestieVoiceSystemPrompt`
- `src/lib/server/voice-call-context.ts` — spoken system-prompt assembly
- `src/lib/server/livekit.ts` — token minting + agent dispatch
- `src/lib/server/elevenlabs.ts` — voice clone + voice selection
- `src/lib/server/voice-summary.ts` — transcript → recap message
- `src/lib/server/voice-auth.ts` — user-token + worker-secret auth
- `src/routes/api/voice/calls/start` — male taps call
- `src/routes/api/voice/calls/[callId]/context` — worker fetches prompt (worker-only)
- `src/routes/api/voice/calls/[callId]/finalize` — worker posts transcript (worker-only)
- `src/routes/api/voice/tools` — bestie tools (worker-only)
- `src/routes/api/voice/profile` (+ `/sample`) — female opt-in + voice clone
- `src/lib/verified-vibe/components/VoiceCall.svelte` — male in-call UI
- `src/lib/verified-vibe/components/VoiceOnboarding.svelte` — female opt-in + record/clone

Worker (off-Vercel):
- `voice-agent/` — LiveKit Agents worker (`src/agent.ts`), Dockerfile, fly.toml

## Provisioning checklist (nothing works until these are done)

1. **Run the migration** — `20260603174904_voice_ai_bestie_calls.sql` (already
   applied on the `stikoktiaxqtcsohcxzp` project). For a fresh environment, paste
   it into the Supabase SQL editor (no `exec_sql` in this project).
2. **Create a Storage bucket** named `voice-samples` (private) for consented
   voice samples.
3. **LiveKit** — create a Cloud project; set `LIVEKIT_URL/API_KEY/API_SECRET` on
   both Vercel and the worker. Keep `LIVEKIT_AGENT_NAME` identical on both.
4. **Deepgram** — `DEEPGRAM_API_KEY` (worker only).
5. **ElevenLabs** — `ELEVENLABS_API_KEY` (app + worker). Pick a default voice and
   set `ELEVENLABS_DEFAULT_VOICE_ID` (app). Voice cloning requires a paid plan.
6. **Anthropic** — `ANTHROPIC_API_KEY` on the worker (same model as the app).
7. **Shared secret** — set the same `VOICE_WORKER_SECRET` on Vercel and the worker.
8. **Deploy the worker** — `cd voice-agent && fly deploy` (or any always-on host);
   set `APP_URL` to the Vercel URL.
9. Install app deps already added to `package.json`: `livekit-client`,
   `livekit-server-sdk` (`npm install`).

## Phase status

- **Done (this branch):** schema, voice identity + clone, opt-in, male-initiated
  in-app WebRTC call, the worker, tools, transcript → recap into the thread,
  6-minute cap, latency logged as `voice_summary`.
- **Worker note:** `voice-agent/src/agent.ts` targets `@livekit/agents` 0.7.x. The
  JS Agents API is young — pin a version and reconcile session/event names; the
  flow (fetch context → start session → capture transcript → finalize) is stable.
- **Next:** opt-in recording + storage/retention, longer calls, no-answer/drop &
  stale-ringing reaping (a cron), PSTN via LiveKit SIP, iOS ring via the
  Capacitor wrapper (`device_tokens` + CallKit), QA console + AI-latency-tab
  surfacing of voice calls.

## Known gaps / risks

- **Consent is the product, not a footnote.** Cloning a real person's voice to
  talk to matches is the central ethical surface. The clone needs her explicit
  consent (captured in `vv_voice_profiles.clone_consent_at`); the male hears an
  AI + recording disclosure preamble every call. Don't weaken either.
- **Cost.** Assembled stack at ~$0.10–0.20/min all-in. The 6-min cap bounds it;
  raise deliberately.
- **Stale ringing calls.** If the worker never joins (bad dispatch), a `ringing`
  row lingers. Add a cron to mark old `ringing` rows `failed`.
