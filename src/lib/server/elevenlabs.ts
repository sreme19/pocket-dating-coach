// ============================================================
// elevenlabs.ts — voice cloning + voice-id resolution for the bestie voice call.
//
// The female owner can opt to clone her real voice. We create an Instant Voice
// Clone from a short consented sample and store the returned voice_id on
// vv_voice_profiles. Bestie calls are ON by default for every woman (opt-out).
// At call time we resolve which voice to speak in:
//   - her cloned voice  (if voice_status='cloned' AND she hasn't opted out)
//   - else the stable default premium bestie voice (ELEVENLABS_DEFAULT_VOICE_ID)
//
// The actual TTS streaming happens in the agent worker (voice-agent/); this
// module only handles cloning + selection from the Vercel side.
//
// Requires env: ELEVENLABS_API_KEY, ELEVENLABS_DEFAULT_VOICE_ID.
// ============================================================

import { env } from '$env/dynamic/private';

const API_BASE = 'https://api.elevenlabs.io/v1';

function apiKey(): string {
	const k = env.ELEVENLABS_API_KEY;
	if (!k) throw new Error('ELEVENLABS_API_KEY is not configured.');
	return k;
}

// ElevenLabs "Sarah" — a default voice usable on free plans. Used when no valid
// ELEVENLABS_DEFAULT_VOICE_ID is configured.
const FALLBACK_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';
// Placeholder ids that were set in env by mistake but don't exist on the account
// (TTS fails with voice_id_does_not_exist). Ignore them rather than go silent.
const KNOWN_BAD_VOICE_IDS = new Set(['ecp3DWciuUyW7BYM7II1']);

export function defaultVoiceId(): string {
	const v = env.ELEVENLABS_DEFAULT_VOICE_ID;
	if (!v || KNOWN_BAD_VOICE_IDS.has(v.trim())) return FALLBACK_VOICE_ID;
	return v.trim();
}

/**
 * Create an Instant Voice Clone from a consented sample. Returns the new
 * ElevenLabs voice_id. Throws on failure so the caller can mark voice_status.
 *
 * @param name        label for the voice (e.g. "Mekhala (cloned)")
 * @param sample      the audio sample bytes
 * @param sampleMime  e.g. 'audio/webm' | 'audio/mpeg' | 'audio/wav'
 */
export async function cloneVoice(
	name: string,
	sample: Blob | ArrayBuffer | Uint8Array,
	sampleMime = 'audio/webm'
): Promise<string> {
	const form = new FormData();
	form.append('name', name);
	form.append(
		'description',
		'Verified Vibe AI Bestie — consented voice clone used only for this user’s own bestie calls.'
	);
	const blob =
		sample instanceof Blob
			? sample
			: new Blob([sample as BlobPart], { type: sampleMime });
	form.append('files', blob, `sample.${sampleMime.split('/')[1] || 'webm'}`);

	const res = await fetch(`${API_BASE}/voices/add`, {
		method: 'POST',
		headers: { 'xi-api-key': apiKey() },
		body: form
	});

	if (!res.ok) {
		const detail = await res.text().catch(() => '');
		throw new Error(`ElevenLabs clone failed (${res.status}): ${detail.slice(0, 300)}`);
	}
	const data = (await res.json()) as { voice_id?: string };
	if (!data.voice_id) throw new Error('ElevenLabs clone returned no voice_id.');
	return data.voice_id;
}

/** Best-effort deletion of a cloned voice (e.g. when she revokes consent). */
export async function deleteVoice(voiceId: string): Promise<void> {
	await fetch(`${API_BASE}/voices/${voiceId}`, {
		method: 'DELETE',
		headers: { 'xi-api-key': apiKey() }
	}).catch(() => undefined);
}

export interface ResolvedVoice {
	voiceId: string;
	usingClonedVoice: boolean;
}

/**
 * Decide which voice the bestie speaks in for a call. Cloned voice only when she
 * fully opted in AND a clone exists; otherwise the default premium voice.
 */
export function resolveVoice(profile: {
	voice_status?: string | null;
	elevenlabs_voice_id?: string | null;
	calls_opt_in?: boolean | null;
} | null): ResolvedVoice {
	if (
		profile &&
		profile.calls_opt_in !== false &&
		profile.voice_status === 'cloned' &&
		profile.elevenlabs_voice_id
	) {
		return { voiceId: profile.elevenlabs_voice_id, usingClonedVoice: true };
	}
	return { voiceId: defaultVoiceId(), usingClonedVoice: false };
}
