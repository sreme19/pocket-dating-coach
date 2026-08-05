/**
 * VOICE_CALLS_ENABLED kill switch on POST /api/voice/calls/start.
 *
 * Why this is worth testing rather than eyeballing: the flag is load-bearing in
 * a way that is easy to break silently. The bestie voice worker is an always-on
 * dedicated Fly machine that is currently scaled to ZERO, so if this gate ever
 * stops refusing, callers don't get an error — they get a LiveKit room that no
 * agent will ever join, and they sit in "Connecting…" until the reap-stale-calls
 * cron marks the row 'no_answer'. A silent regression here looks like a hang.
 *
 * The three properties that matter:
 *   1. OFF unless the flag is exactly 'true' (fail closed, never fail open).
 *   2. When OFF, do ZERO work — no auth, no DB row, no LiveKit dispatch.
 *   3. The refusal carries a human `message`, because both shipped clients
 *      render that field verbatim and cannot be rebuilt to say something else.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mutable mock env so we can toggle the kill switch per test.
// Same pattern as photo-signals.test.ts.
const { mockEnv } = vi.hoisted(() => ({ mockEnv: {} as Record<string, string> }));
vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

const { getUserFromRequest } = vi.hoisted(() => ({ getUserFromRequest: vi.fn() }));
const { getSupabase } = vi.hoisted(() => ({ getSupabase: vi.fn() }));
const { mintJoinToken, dispatchVoiceAgent, livekitWsUrl } = vi.hoisted(() => ({
	mintJoinToken: vi.fn(),
	dispatchVoiceAgent: vi.fn(),
	livekitWsUrl: vi.fn()
}));
const { resolveVoice } = vi.hoisted(() => ({ resolveVoice: vi.fn() }));

vi.mock('$lib/server/voice-auth', () => ({ getUserFromRequest }));
vi.mock('$lib/server/supabase', () => ({ getSupabase }));
vi.mock('$lib/server/elevenlabs', () => ({ resolveVoice }));
vi.mock('$lib/server/livekit', () => ({ mintJoinToken, dispatchVoiceAgent, livekitWsUrl }));

import { POST } from './+server';

/** A well-formed request — so nothing but the flag can explain a refusal. */
function req(body: unknown = { matchId: 'a-match-id', consent: true }) {
	return new Request('http://localhost/api/voice/calls/start', {
		method: 'POST',
		headers: { 'content-type': 'application/json', Authorization: 'Bearer fake-token' },
		body: JSON.stringify(body)
	});
}

/** The route only destructures `request`, so this is enough of an event. */
function call(request: Request) {
	return (POST as unknown as (e: { request: Request }) => Promise<Response>)({ request });
}

beforeEach(() => {
	for (const k of Object.keys(mockEnv)) delete mockEnv[k];
	vi.clearAllMocks();
	// Default: a valid caller. Any refusal in the OFF tests is therefore the
	// gate's doing and not a missing auth stub.
	getUserFromRequest.mockResolvedValue({ id: 'caller-id' });
});

describe('VOICE_CALLS_ENABLED — kill switch', () => {
	it('refuses with 503 voice_disabled when the flag is absent (default OFF)', async () => {
		const res = await call(req());
		expect(res.status).toBe(503);
		await expect(res.json()).resolves.toMatchObject({ error: 'voice_disabled' });
	});

	it('is ON only when the flag is exactly "true" — everything else fails closed', async () => {
		for (const v of ['false', '1', 'TRUE', 'True', 'yes', 'on', '']) {
			mockEnv.VOICE_CALLS_ENABLED = v;
			const res = await call(req());
			expect(res.status, `VOICE_CALLS_ENABLED=${JSON.stringify(v)} must stay OFF`).toBe(503);
		}
	});

	it('lets the request through to normal auth when the flag is "true"', async () => {
		mockEnv.VOICE_CALLS_ENABLED = 'true';
		getUserFromRequest.mockResolvedValue(null); // unauthenticated caller
		const res = await call(req());
		// 401, not 503: the gate is open and the request reached the auth check.
		expect(res.status).toBe(401);
		expect(getUserFromRequest).toHaveBeenCalled();
	});
});

describe('when OFF, the route does no work', () => {
	it('short-circuits before auth, the DB, and LiveKit dispatch', async () => {
		const res = await call(req());
		expect(res.status).toBe(503);
		// Checked before auth so an off feature costs nothing.
		expect(getUserFromRequest).not.toHaveBeenCalled();
		// The important one: no 'ringing' row is created, so the reaper has
		// nothing to sweep and admin/qa/voice stays clean.
		expect(getSupabase).not.toHaveBeenCalled();
		// And no agent is summoned to a machine that is scaled to zero.
		expect(dispatchVoiceAgent).not.toHaveBeenCalled();
		expect(mintJoinToken).not.toHaveBeenCalled();
	});

	it('refuses even a malformed body, without falling through to validation', async () => {
		const res = await call(req({}));
		// Not 400 — the kill switch outranks request validation.
		expect(res.status).toBe(503);
		expect(getSupabase).not.toHaveBeenCalled();
	});
});

describe('the refusal copy is the client contract', () => {
	it('carries a non-empty human message, because both clients render it verbatim', async () => {
		const res = await call(req());
		const body = (await res.json()) as { error?: string; message?: string };
		// api.dart startVoiceCall prefers data['message'] over the code, and
		// VoiceCall.svelte shows it as-is. An empty message would surface the
		// generic "Could not start the call." on native and a blank web notice.
		expect(body.message?.trim()).toBeTruthy();
		expect(body.message).not.toBe(body.error);
		expect(body.message).not.toMatch(/voice_disabled/);
	});

	it('does not blame the woman for a global pause', async () => {
		const res = await call(req());
		const { message } = (await res.json()) as { message: string };
		// The neighbouring 403s legitimately say "<her> bestie isn't taking
		// calls" — that copy is about HER opt-out. Reusing it here would tell a
		// caller she declined him when in fact we switched the feature off.
		expect(message).not.toMatch(/isn't taking|not taking|opted out|declined/i);
		// It should point him somewhere useful instead: the thread still works.
		expect(message).toMatch(/chat/i);
	});
});
