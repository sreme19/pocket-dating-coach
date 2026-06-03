// ============================================================
// livekit.ts — server helpers for minting room join tokens and dispatching the
// bestie voice agent into a room.
//
// The live media never touches Vercel. We only: create a room name, mint a
// short-lived join token for the caller, and tell the always-on agent worker to
// join. The worker (voice-agent/) does VAD -> STT -> Claude -> ElevenLabs TTS.
//
// Requires env: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET.
// ============================================================

import { env } from '$env/dynamic/private';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

function requireEnv(name: string): string {
	const v = env[name];
	if (!v) throw new Error(`${name} is not configured (LiveKit voice calls).`);
	return v;
}

export function livekitWsUrl(): string {
	return requireEnv('LIVEKIT_URL');
}

/**
 * Mint a join token for a participant. Scoped to a single room, short TTL — the
 * call should connect promptly or the token expires.
 */
export async function mintJoinToken(opts: {
	room: string;
	identity: string;
	name?: string;
	ttlSeconds?: number;
}): Promise<string> {
	const at = new AccessToken(requireEnv('LIVEKIT_API_KEY'), requireEnv('LIVEKIT_API_SECRET'), {
		identity: opts.identity,
		name: opts.name,
		ttl: opts.ttlSeconds ?? 120
	});
	at.addGrant({
		room: opts.room,
		roomJoin: true,
		canPublish: true,
		canSubscribe: true,
		canPublishData: true
	});
	return await at.toJwt();
}

/**
 * Dispatch the bestie agent into the room. We use LiveKit explicit agent
 * dispatch: the worker registers under AGENT_NAME and joins on dispatch. The
 * `metadata` carries the call id so the worker can fetch its context + finalise.
 */
export async function dispatchVoiceAgent(room: string, callId: string): Promise<void> {
	const agentName = env.LIVEKIT_AGENT_NAME || 'bestie-voice';
	const svc = new RoomServiceClient(
		requireEnv('LIVEKIT_URL'),
		requireEnv('LIVEKIT_API_KEY'),
		requireEnv('LIVEKIT_API_SECRET')
	);
	// Ensure the room exists with metadata, then dispatch the agent. We embed the
	// callId in room metadata as the source of truth the worker reads on join.
	await svc.createRoom({ name: room, metadata: JSON.stringify({ callId }), emptyTimeout: 60 });

	// Explicit dispatch via the AgentDispatch API. Imported lazily so a missing
	// optional export never breaks token minting (the common path).
	try {
		const { AgentDispatchClient } = await import('livekit-server-sdk');
		const dispatch = new AgentDispatchClient(
			requireEnv('LIVEKIT_URL'),
			requireEnv('LIVEKIT_API_KEY'),
			requireEnv('LIVEKIT_API_SECRET')
		);
		await dispatch.createDispatch(room, agentName, { metadata: JSON.stringify({ callId }) });
	} catch (e) {
		// If explicit dispatch isn't available, the worker can also be configured
		// to auto-join rooms; surface but don't fail the call setup.
		console.warn('[livekit] explicit agent dispatch unavailable, relying on auto-join:', e);
	}
}
