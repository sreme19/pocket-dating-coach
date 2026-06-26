import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import { getUserFromRequest } from '$lib/server/voice-auth';

/**
 * GET /api/voice/profile  — current user's voice profile status.
 * Returns { voiceStatus, callsOptIn, hasClone }.
 */
export const GET: RequestHandler = async ({ request }) => {
	const user = await getUserFromRequest(request);
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const supabase = getSupabase();
	const [{ data }, { data: userRow }] = await Promise.all([
		(supabase as any)
			.from('vv_voice_profiles')
			.select('voice_status, calls_opt_in, elevenlabs_voice_id, failure_reason')
			.eq('user_id', user.id)
			.maybeSingle(),
		supabase.from('verified_vibe_users').select('gender').eq('id', user.id).single()
	]);

	return json({
		gender: (userRow as any)?.gender ?? null,
		voiceStatus: data?.voice_status ?? 'none',
		// Bestie voice calls default ON for women (opt-out), OFF for men.
		callsOptIn: data?.calls_opt_in ?? ((userRow as any)?.gender === 'woman'),
		hasClone: data?.voice_status === 'cloned' && !!data?.elevenlabs_voice_id,
		failureReason: data?.failure_reason ?? null
	});
};

/**
 * POST /api/voice/profile  — toggle whether her bestie accepts calls.
 * Body: { callsOptIn: boolean }
 */
export const POST: RequestHandler = async ({ request }) => {
	const user = await getUserFromRequest(request);
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = (await request.json()) as { callsOptIn?: boolean };
	if (typeof body.callsOptIn !== 'boolean') {
		return json({ error: 'callsOptIn must be a boolean' }, { status: 400 });
	}

	const supabase = getSupabase();
	await (supabase as any)
		.from('vv_voice_profiles')
		.upsert(
			{ user_id: user.id, calls_opt_in: body.callsOptIn, updated_at: new Date().toISOString() },
			{ onConflict: 'user_id' }
		);

	return json({ ok: true, callsOptIn: body.callsOptIn });
};
