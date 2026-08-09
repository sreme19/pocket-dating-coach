/**
 * POST /api/verified-vibe/upload-photo
 *
 * Uploads a single profile photo (base64 dataURL) to Supabase Storage and
 * returns its public URL. If the photo is the lead, also updates avatar_url.
 * Already-hosted URLs (e.g. AI fal.ai photos) are returned/stored as-is.
 *
 * Body: { dataUrl?: string; imageUrl?: string; label: string }
 * Response: { url: string }
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import { captureUploads } from '$lib/server/upload-audit';
import { screenProfilePhotos, gateRecord } from '$lib/server/photo-identity-gate';
import { recomputeAndNormalize } from '$lib/server/trust-normalize';
import { enrollInPoolIfVerified } from '$lib/server/pool-registry';

const MIME_TO_EXT: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/jpg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif'
};

function sanitizeLabel(label: string): string {
	return (label || 'photo').replace(/[^a-z0-9_-]/gi, '_').slice(0, 40);
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const authHeader = request.headers.get('authorization') ?? '';
		const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
		if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

		const { createClient } = await import('@supabase/supabase-js');
		const { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } = await import('$env/static/public');
		const userClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
			global: { headers: { Authorization: `Bearer ${token}` } }
		});
		const { data: { user }, error: userErr } = await userClient.auth.getUser();
		if (userErr || !user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

		const body = await request.json() as { dataUrl?: string; imageUrl?: string; label?: string };
		const label = sanitizeLabel(body.label ?? 'photo');
		const supabase = getSupabase();

		// The profile-photo feature stores a man's raw upload as the AI enhancer's
		// reference (same as onboarding does) — but it is EDIT-ONLY and never
		// presented: it is excluded from every public/display photo set, and (see
		// the avatar mirror below) it must never become his avatar_url. His avatar
		// is only ever the AI lead portrait, set by saveAiPhotos.
		const { data: u } = await supabase
			.from('verified_vibe_users')
			.select('gender')
			.eq('id', user.id)
			.maybeSingle();
		const isMan = (u as { gender?: string } | null)?.gender === 'man';

		let url: string;
		// Carried out of the upload branch so the photos-step backstop below can
		// record the same verdict onboarding would have recorded.
		let screened: Awaited<ReturnType<typeof screenProfilePhotos>> | null = null;

		if (body.imageUrl && /^https?:\/\//.test(body.imageUrl)) {
			// Already hosted (AI photo) — keep as-is.
			url = body.imageUrl;
		} else if (body.dataUrl && body.dataUrl.startsWith('data:')) {
			const match = body.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
			if (!match) return json({ error: 'Invalid data URL' }, { status: 400 });

			const mime = match[1];
			const ext = MIME_TO_EXT[mime] ?? 'jpg';
			const buffer = Buffer.from(match[2], 'base64');
			const path = `photos/${user.id}/${label}.${ext}`;

			// Identity gate — the same rule onboarding enforces, applied to photo EDITS.
			// Without this a user could clear onboarding with a genuine photo and then
			// quietly swap in a poster or someone else from the profile screen. Only an
			// authoritative 'rejected' verdict blocks (see photo-identity-gate for the
			// fail-open posture), and it happens BEFORE the bytes reach Storage.
			//
			// 'unconfirmed' deliberately does NOT block here: this is one ADDITIONAL photo
			// on a profile that already proved its owner at onboarding, so a back-turned or
			// distant shot is a perfectly good gallery photo. Only "provably not you" stops
			// an edit.
			const gate = await screenProfilePhotos(user.id, [{ data: match[2], mime }]);
			screened = gate;
			if (gate.status === 'rejected') {
				console.warn(`[upload-photo] rejected photo for ${user.id}: not the verified owner`);
				return json(
					{
						error: gate.rejected[0]?.reason
							? `${gate.rejected[0].reason} Please upload a photo of yourself — the same face as your verification selfie.`
							: gate.message,
						code: 'photo_identity_mismatch',
					},
					{ status: 422 }
				);
			}

			// This photo IS the owner, confirmed against the verification selfie. If the
			// profile was carrying a 'rejected' verdict from an earlier screening, that
			// verdict is now stale and must be cleared — otherwise a user who does exactly
			// what we asked (remove the fakes, upload a real photo of yourself) stays hidden
			// from Discover forever. Observed live: the profile that started this work
			// re-uploaded two genuine photos and would have remained invisible.
			if (gate.status === 'passed') {
				const { data: stepRow } = await (supabase as any)
					.from('verified_vibe_verification')
					.select('id, data')
					.eq('user_id', user.id)
					.eq('step', 'photos')
					.maybeSingle();
				const prev = (stepRow as any)?.data ?? {};
				if (prev?.identityGate?.status === 'rejected') {
					await (supabase as any)
						.from('verified_vibe_verification')
						.update({
							data: {
								...prev,
								identityGate: {
									...prev.identityGate,
									status: 'passed',
									clearedAt: new Date().toISOString(),
									clearedBy: 'profile-photo-upload',
								},
							},
						})
						.eq('id', (stepRow as any).id);
				}
			}

			const { error: uploadErr } = await supabase.storage
				.from('profiles')
				.upload(path, buffer, { contentType: mime, upsert: true });

			if (uploadErr) {
				console.error('Photo storage upload error:', uploadErr);
				return json({ error: 'Failed to upload image' }, { status: 500 });
			}

			const { data: urlData } = supabase.storage.from('profiles').getPublicUrl(path);
			url = `${urlData.publicUrl}?v=${buffer.length}`;

			// Admin-review capture — reference the stored profile photo (no re-upload).
			await captureUploads({
				userId: user.id,
				source: 'profile-photo',
				category: label,
				items: [{ existingUrl: url, name: `${label}.${ext}`, mimeType: mime, sizeBytes: buffer.length }],
			});
		} else {
			return json({ error: 'Provide dataUrl or imageUrl' }, { status: 400 });
		}

		// If this is the lead photo, mirror it to avatar_url — but NEVER for a man
		// (his raw photo must not be presented anywhere; his avatar is the AI lead).
		if (label === 'lead' && !isMan) {
			await supabase
				.from('verified_vibe_users')
				.update({ avatar_url: url })
				.eq('id', user.id);
		}

		// ── The photos step is a claim about the profile, not about one screen ──
		// Discovery and the matchmaker pool both ask "does a `photos` verification
		// row exist?" — never "does this profile have photos?". Only the onboarding
		// photos step ever wrote that row, so a user who arrived at their photos
		// through the profile screen instead ended up with real, screened, published
		// photos and no row: complete profile, verified selfie, invisible to every
		// other member. Three live users were in that state.
		//
		// So publishing a photo here ensures the row too. Deliberately narrow:
		//  - only the screened upload path (an already-hosted AI portrait is derived
		//    from a raw photo that came through here first),
		//  - never overwrites an existing row — verify-step's record is richer, and
		//    the stale-'rejected' clearing above already owns that case,
		//  - 'unverified' (no anchor selfie) still counts, exactly as onboarding
		//    records it. It does not make anyone poolable on its own: liveness is
		//    the other half of POOL_REQUIRED_STEPS.
		if (screened && screened.status !== 'rejected') {
			try {
				const { data: existing } = await (supabase as any)
					.from('verified_vibe_verification')
					.select('id')
					.eq('user_id', user.id)
					.eq('step', 'photos')
					.maybeSingle();
				if (!existing) {
					const now = new Date().toISOString();
					await (supabase as any).from('verified_vibe_verification').insert({
						user_id: user.id,
						step: 'photos',
						status: 'completed',
						data: {
							photoCount: 1,
							source: 'profile-photo-upload',
							identityGate: gateRecord(screened, now),
						},
						completed_at: now,
					});
					recomputeAndNormalize(user.id).catch((e) =>
						console.warn('[upload-photo] trust recompute failed (non-fatal):', e)
					);
					enrollInPoolIfVerified(user.id).catch((e) =>
						console.warn('[upload-photo] pool enrol failed (non-fatal):', e)
					);
				}
			} catch (e) {
				// Never fail the upload over bookkeeping — the photo is already live.
				console.warn('[upload-photo] photos-step backstop failed (non-fatal):', e);
			}
		}

		return json({ url });
	} catch (err) {
		console.error('upload-photo error:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
