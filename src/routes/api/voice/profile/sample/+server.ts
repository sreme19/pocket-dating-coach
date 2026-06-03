import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import { getUserFromRequest } from '$lib/server/voice-auth';
import { cloneVoice, deleteVoice } from '$lib/server/elevenlabs';

const VOICE_BUCKET = 'voice-samples';

/**
 * POST /api/voice/profile/sample  — upload a consented voice sample and clone it.
 *
 * Multipart form: { sample: File (audio), consent: 'true' }
 * Stores the sample in Supabase Storage, creates an ElevenLabs instant clone,
 * and records the voice_id. On failure, marks voice_status='failed'.
 */
export const POST: RequestHandler = async ({ request }) => {
	const user = await getUserFromRequest(request);
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const form = await request.formData();
	const consent = form.get('consent');
	if (consent !== 'true') {
		return json({ error: 'Explicit consent is required to clone your voice.' }, { status: 400 });
	}
	const sample = form.get('sample');
	if (!(sample instanceof File) || sample.size === 0) {
		return json({ error: 'A voice sample file is required.' }, { status: 400 });
	}
	if (sample.size > 15 * 1024 * 1024) {
		return json({ error: 'Sample too large (max 15MB).' }, { status: 400 });
	}

	const supabase = getSupabase();
	const ext = (sample.type.split('/')[1] || 'webm').replace(/[^a-z0-9]/gi, '');
	const path = `${user.id}/sample-${Date.now()}.${ext}`;
	const bytes = new Uint8Array(await sample.arrayBuffer());

	// Resolve her first name for a friendly clone label + existing clone cleanup.
	const [{ data: userRow }, { data: existing }] = await Promise.all([
		supabase.from('verified_vibe_users').select('first_name').eq('id', user.id).single(),
		(supabase as any)
			.from('vv_voice_profiles')
			.select('elevenlabs_voice_id')
			.eq('user_id', user.id)
			.maybeSingle()
	]);
	const firstName = (userRow as any)?.first_name || 'User';

	// 1. Store the consented sample.
	const { error: upErr } = await supabase.storage
		.from(VOICE_BUCKET)
		.upload(path, bytes, { contentType: sample.type || 'audio/webm', upsert: true });
	if (upErr) {
		console.error('[voice/sample] upload failed:', upErr);
		return json({ error: 'Failed to store sample' }, { status: 500 });
	}

	// Mark cloning in progress + record consent.
	await (supabase as any).from('vv_voice_profiles').upsert(
		{
			user_id: user.id,
			voice_status: 'cloning',
			sample_url: path,
			clone_consent_at: new Date().toISOString(),
			failure_reason: null,
			updated_at: new Date().toISOString()
		},
		{ onConflict: 'user_id' }
	);

	// 2. Clone via ElevenLabs.
	try {
		const voiceId = await cloneVoice(`${firstName} (Verified Vibe bestie)`, bytes, sample.type || 'audio/webm');

		// Best-effort: remove a previous clone so we don't leak voices.
		if (existing?.elevenlabs_voice_id && existing.elevenlabs_voice_id !== voiceId) {
			await deleteVoice(existing.elevenlabs_voice_id);
		}

		await (supabase as any)
			.from('vv_voice_profiles')
			.update({
				voice_status: 'cloned',
				elevenlabs_voice_id: voiceId,
				failure_reason: null,
				updated_at: new Date().toISOString()
			})
			.eq('user_id', user.id);

		return json({ ok: true, voiceStatus: 'cloned' });
	} catch (e) {
		console.error('[voice/sample] clone failed:', e);
		await (supabase as any)
			.from('vv_voice_profiles')
			.update({
				voice_status: 'failed',
				failure_reason: e instanceof Error ? e.message.slice(0, 300) : String(e),
				updated_at: new Date().toISOString()
			})
			.eq('user_id', user.id);
		return json({ error: 'Voice cloning failed. Please try again.' }, { status: 502 });
	}
};
