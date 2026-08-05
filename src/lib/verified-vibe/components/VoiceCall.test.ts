/**
 * VoiceCall.svelte — the caller-facing half of the VOICE_CALLS_ENABLED switch.
 *
 * The component deliberately learns that voice is off from the server's 503
 * rather than a build-time public env var, so the flag lives in exactly one
 * place (Vercel) and re-enabling needs no web rebuild. That design only pays off
 * if the 503 path actually lands somewhere sane, which is what this covers:
 * the caller gets the server's sentence, and the launch button does NOT come
 * back to invite a second doomed attempt.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import VoiceCall from './VoiceCall.svelte';

// The component lazy-imports this inside connect(). Under jsdom the real module
// reads $env/dynamic/public and throws, which would send us down the generic
// error path and mask what we're actually testing.
vi.mock('$lib/client/supabase', () => ({
	getSupabaseClient: () => ({
		auth: { getSession: async () => ({ data: { session: { access_token: 'fake' } } }) }
	})
}));

const DISABLED_COPY = 'Voice calls are paused right now — keep chatting here and her bestie will reply.';

function mockStart(status: number, body: unknown) {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))
	);
}

/** Walk idle -> consent -> connect, the way a caller does. */
async function tapThroughToCall() {
	await screen.getByRole('button', { name: /Talk to .*AI bestie/i }).click();
	const confirm = await screen.findByRole('button', { name: /I understand — call/i });
	await confirm.click();
}

beforeEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('server-side kill switch (503 voice_disabled)', () => {
	beforeEach(() => mockStart(503, { error: 'voice_disabled', message: DISABLED_COPY }));

	it("shows the server's sentence verbatim", async () => {
		render(VoiceCall, { conversationId: 'match-1', ownerName: 'Dewi' });
		await tapThroughToCall();
		await waitFor(() => expect(screen.getByText(DISABLED_COPY)).toBeTruthy());
	});

	it('retires the launch button instead of inviting a retry', async () => {
		render(VoiceCall, { conversationId: 'match-1', ownerName: 'Dewi' });
		await tapThroughToCall();
		await waitFor(() => expect(screen.getByText(DISABLED_COPY)).toBeTruthy());
		// No "Talk to…" to tap again, and no Close that would reset to idle —
		// there is nothing on the other end to retry against.
		expect(screen.queryByRole('button', { name: /Talk to .*AI bestie/i })).toBeNull();
		expect(screen.queryByRole('button', { name: /Close/i })).toBeNull();
	});

	it('never shows the raw error code to the caller', async () => {
		render(VoiceCall, { conversationId: 'match-1', ownerName: 'Dewi' });
		await tapThroughToCall();
		await waitFor(() => expect(screen.getByText(DISABLED_COPY)).toBeTruthy());
		expect(document.body.textContent).not.toMatch(/voice_disabled/);
	});

	it('falls back to its own copy if the server sends no message', async () => {
		mockStart(503, { error: 'voice_disabled' });
		render(VoiceCall, { conversationId: 'match-1', ownerName: 'Dewi' });
		await tapThroughToCall();
		await waitFor(() => expect(screen.getByText(/Voice calls are paused/i)).toBeTruthy());
	});
});

describe('other failures keep the retryable error path', () => {
	it('a 403 opt-out is an error with a Close button, not the disabled state', async () => {
		// Regression guard: the 503 branch must not swallow the neighbouring
		// refusals. Her explicit opt-out is temporary and worth retrying later,
		// so it keeps the dismissible error UI.
		mockStart(403, { error: 'not_enabled', message: "Dewi's bestie isn't taking calls right now." });
		render(VoiceCall, { conversationId: 'match-1', ownerName: 'Dewi' });
		await tapThroughToCall();
		await waitFor(() => expect(screen.getByText(/isn't taking calls right now/i)).toBeTruthy());
		expect(screen.getByRole('button', { name: /Close/i })).toBeTruthy();
	});

	it('a 503 from something other than the kill switch stays a normal error', async () => {
		mockStart(503, { error: 'upstream_unavailable', message: 'Service unavailable.' });
		render(VoiceCall, { conversationId: 'match-1', ownerName: 'Dewi' });
		await tapThroughToCall();
		await waitFor(() => expect(screen.getByText('Service unavailable.')).toBeTruthy());
		expect(screen.getByRole('button', { name: /Close/i })).toBeTruthy();
	});
});
