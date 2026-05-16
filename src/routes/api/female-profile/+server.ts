import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
import type {
	FemaleGeneratedProfile,
	FemaleJourneyAnswer,
	FemalePhotoAsset,
	FemalePreferenceModel
} from '$lib/types';

type FemaleProfilePayload = {
	sessionId: string;
	displayName: string;
	ageRange: string;
	city: string;
	intent: string;
	approvedForMatching: boolean;
	photoAssets: FemalePhotoAsset[];
	answers: FemaleJourneyAnswer[];
	generatedProfile: FemaleGeneratedProfile | null;
	preferenceModel: FemalePreferenceModel | null;
};

const PHOTO_BUCKET = 'profile-uploads';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

function requireSessionId(value: unknown): string {
	if (typeof value !== 'string' || value.trim().length < 8) {
		throw error(400, 'sessionId is required');
	}
	return value.trim();
}

function normalizePhotos(photos: unknown): FemalePhotoAsset[] {
	if (!Array.isArray(photos)) return [];
	return photos
		.filter((photo): photo is FemalePhotoAsset => {
			return (
				photo &&
				typeof photo === 'object' &&
				typeof photo.id === 'string' &&
				typeof photo.name === 'string' &&
				typeof photo.storyRole === 'string'
			);
		})
		.slice(0, 12);
}

function normalizeAnswers(answers: unknown): FemaleJourneyAnswer[] {
	if (!Array.isArray(answers)) return [];
	return answers
		.filter((answer): answer is FemaleJourneyAnswer => {
			return (
				answer &&
				typeof answer === 'object' &&
				typeof answer.id === 'string' &&
				typeof answer.prompt === 'string' &&
				typeof answer.answer === 'string' &&
				typeof answer.category === 'string'
			);
		})
		.slice(0, 80);
}

export const GET: RequestHandler = async ({ url }) => {
	const sessionId = requireSessionId(url.searchParams.get('sessionId'));
	const supabase = getSupabase();

	try {
		const { data: profile, error: profileError } = await supabase
			.from('female_profiles')
			.select('*')
			.eq('session_id', sessionId)
			.maybeSingle();

		if (profileError) throw error(500, profileError.message);
		if (!profile) return json({ profile: null });

		const [photosResult, answersResult, generatedResult] = await Promise.all([
			supabase
				.from('female_profile_photos')
				.select('*')
				.eq('profile_id', profile.id)
				.order('sort_order', { ascending: true }),
			supabase
				.from('female_profile_answers')
				.select('*')
				.eq('profile_id', profile.id)
				.order('sort_order', { ascending: true }),
			supabase
				.from('female_generated_profiles')
				.select('*')
				.eq('profile_id', profile.id)
				.order('created_at', { ascending: false })
				.limit(1)
				.maybeSingle()
		]);

		if (photosResult.error) throw error(500, photosResult.error.message);
		if (answersResult.error) throw error(500, answersResult.error.message);
		if (generatedResult.error) throw error(500, generatedResult.error.message);

		const photoAssets: FemalePhotoAsset[] = await Promise.all(
			(photosResult.data ?? []).map(async (photo) => {
				let url = photo.preview_url ?? '';
				if (photo.storage_path) {
					const { data: signedData } = await supabase.storage
						.from(PHOTO_BUCKET)
						.createSignedUrl(photo.storage_path, SIGNED_URL_TTL_SECONDS);
					url = signedData?.signedUrl ?? url;
				}
				return {
					id: photo.client_id ?? photo.id,
					name: photo.file_name,
					url,
					storagePath: photo.storage_path,
					storyRole: photo.story_role,
					note: photo.note
				};
			})
		);

		const answers: FemaleJourneyAnswer[] = (answersResult.data ?? []).map((answer) => ({
			id: answer.client_id ?? answer.id,
			prompt: answer.prompt,
			answer: answer.answer,
			category: answer.category
		}));

		const generatedProfile: FemaleGeneratedProfile | null = generatedResult.data
			? {
					headline: generatedResult.data.headline,
					publicIntro: generatedResult.data.public_intro,
					photoStory: generatedResult.data.photo_story,
					whatSheValues: generatedResult.data.what_she_values,
					conversationHooks: generatedResult.data.conversation_hooks,
					privateMatchBrief: generatedResult.data.private_match_brief,
					compatibilitySignals: generatedResult.data.compatibility_signals,
					approvedForMatching: generatedResult.data.approved_for_matching,
					updatedAt: new Date(generatedResult.data.updated_at).getTime()
				}
			: null;

		return json({
			profile: {
				displayName: profile.display_name ?? '',
				ageRange: profile.age_range ?? '25-30',
				city: profile.city ?? '',
				intent: profile.intent ?? 'intentional dating',
				approvedForMatching: profile.approved_for_matching,
				photoAssets,
				answers,
				generatedProfile,
				preferenceModel: generatedResult.data?.preference_model ?? null
			}
		});
	} catch (err) {
		console.error('[api/female-profile] Supabase read failed:', err);
		throw error(503, 'Female profile storage is temporarily unavailable');
	}
};

export const POST: RequestHandler = async ({ request }) => {
	let body: FemaleProfilePayload;

	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const sessionId = requireSessionId(body.sessionId);
	const photoAssets = normalizePhotos(body.photoAssets);
	const answers = normalizeAnswers(body.answers);
	const supabase = getSupabase();

	try {
		const { data: profile, error: upsertError } = await supabase
			.from('female_profiles')
			.upsert(
				{
					session_id: sessionId,
					display_name: body.displayName || null,
					age_range: body.ageRange || null,
					city: body.city || null,
					intent: body.intent || null,
					approved_for_matching: Boolean(body.approvedForMatching)
				},
				{ onConflict: 'session_id' }
			)
			.select('*')
			.single();

		if (upsertError) throw error(500, upsertError.message);

		const profileId = profile.id;

		const [deletePhotos, deleteAnswers] = await Promise.all([
			supabase.from('female_profile_photos').delete().eq('profile_id', profileId),
			supabase.from('female_profile_answers').delete().eq('profile_id', profileId)
		]);

		if (deletePhotos.error) throw error(500, deletePhotos.error.message);
		if (deleteAnswers.error) throw error(500, deleteAnswers.error.message);

		if (photoAssets.length > 0) {
			const { error: photoError } = await supabase.from('female_profile_photos').insert(
				photoAssets.map((photo, index) => ({
					profile_id: profileId,
					client_id: photo.id,
					file_name: photo.name,
					preview_url: photo.url.startsWith('blob:') ? null : photo.url,
					storage_path: photo.storagePath ?? null,
					story_role: photo.storyRole,
					note: photo.note,
					sort_order: index
				}))
			);
			if (photoError) throw error(500, photoError.message);
		}

		if (answers.length > 0) {
			const { error: answerError } = await supabase.from('female_profile_answers').insert(
				answers.map((answer, index) => ({
					profile_id: profileId,
					client_id: answer.id,
					prompt: answer.prompt,
					answer: answer.answer,
					category: answer.category,
					sort_order: index
				}))
			);
			if (answerError) throw error(500, answerError.message);
		}

		if (body.generatedProfile) {
			const { error: generatedError } = await supabase.from('female_generated_profiles').insert({
				profile_id: profileId,
				headline: body.generatedProfile.headline,
				public_intro: body.generatedProfile.publicIntro,
				photo_story: body.generatedProfile.photoStory,
				what_she_values: body.generatedProfile.whatSheValues,
				conversation_hooks: body.generatedProfile.conversationHooks,
				private_match_brief: body.generatedProfile.privateMatchBrief,
				compatibility_signals: body.generatedProfile.compatibilitySignals,
				preference_model: (body.preferenceModel ?? {}) as unknown as Record<string, unknown>,
				approved_for_matching: body.generatedProfile.approvedForMatching
			});
			if (generatedError) throw error(500, generatedError.message);
		}

		await supabase.from('female_profile_audit_events').insert({
			profile_id: profileId,
			session_id: sessionId,
			event_name: 'female_profile_saved',
			metadata: {
				photoCount: photoAssets.length,
				answerCount: answers.length,
				hasGeneratedProfile: Boolean(body.generatedProfile),
				approvedForMatching: Boolean(body.approvedForMatching)
			}
		});

		return json({ ok: true, profileId });
	} catch (err) {
		console.error('[api/female-profile] Supabase write failed:', err);
		throw error(503, 'Female profile storage is temporarily unavailable');
	}
};
