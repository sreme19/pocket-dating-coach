import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';

export const load: PageServerLoad = async ({ params }) => {
	const sb = getSupabase() as any;
	const { userId } = params;

	const [
		{ data: user },
		{ data: master },
		{ data: verification },
		{ data: aiPhotos },
		{ data: matches },
		{ data: messages },
	] = await Promise.all([
		sb.from('verified_vibe_users').select('*').eq('id', userId).single(),
		sb.from('user_master_profile').select('data').eq('user_id', userId).maybeSingle(),
		sb.from('verified_vibe_verification').select('*').eq('user_id', userId),
		sb.from('vv_ai_photo_jobs').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
		sb.from('verified_vibe_matches')
			.select('id, status, created_at, user1_id, user2_id')
			.or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
			.order('created_at', { ascending: false }),
		sb.from('verified_vibe_messages')
			.select('id, content, sender_id, created_at, is_ai')
			.eq('sender_id', userId)
			.order('created_at', { ascending: false })
			.limit(20),
	]);

	if (!user) throw error(404, 'User not found');

	const masterData = (master?.data ?? {}) as Record<string, any>;
	const verifiedProofs: any[] = Array.isArray(masterData.verifiedProofs) ? masterData.verifiedProofs : [];

	// Collect all photo URLs from master profile
	const photoUrls: { url: string; label: string }[] = [];

	if (user.avatar_url) photoUrls.push({ url: user.avatar_url, label: 'Avatar' });

	const rawPhotos: any[] = Array.isArray(masterData.rawPhotos) ? masterData.rawPhotos : [];
	for (const p of rawPhotos) {
		if (p?.url) photoUrls.push({ url: p.url, label: 'Lifestyle photo' });
	}

	for (const proof of verifiedProofs) {
		if (proof?.imageUrl) photoUrls.push({ url: proof.imageUrl, label: `Proof: ${proof.category ?? ''}` });
		if (proof?.documentUrl) photoUrls.push({ url: proof.documentUrl, label: `Doc: ${proof.category ?? ''}` });
	}

	// AI generated photos
	const aiPhotoUrls: { url: string; label: string; status: string }[] = [];
	for (const job of aiPhotos ?? []) {
		const photos: any[] = Array.isArray(job.ai_photos) ? job.ai_photos : [];
		for (const p of photos) {
			if (p?.url) aiPhotoUrls.push({ url: p.url, label: 'AI photo', status: job.status ?? '' });
		}
	}

	// Match partners — fetch their names
	const partnerIds = (matches ?? []).map((m: any) =>
		m.user1_id === userId ? m.user2_id : m.user1_id
	);
	const { data: partners } = partnerIds.length
		? await sb.from('verified_vibe_users').select('id, first_name').in('id', partnerIds)
		: { data: [] };
	const partnerName = new Map((partners ?? []).map((p: any) => [p.id, p.first_name]));

	return {
		user: {
			id: user.id,
			firstName: user.first_name,
			age: user.age,
			city: user.city,
			gender: user.gender,
			archetype: user.archetype,
			trustScore: user.trust_score,
			isSeed: user.is_seed,
			about: user.about,
			looking: user.looking,
			createdAt: user.created_at,
			avatarUrl: user.avatar_url,
		},
		masterData: {
			onboarding: masterData.onboarding ?? {},
			generatedProfile: masterData.generatedProfile ?? {},
			moneyMatters: masterData.moneyMatters ?? null,
		},
		verification: (verification ?? []).map((v: any) => ({
			step: v.step,
			status: v.status,
			updatedAt: v.updated_at,
		})),
		verifiedProofs: verifiedProofs.map((p: any) => ({
			category: p.category,
			insights: p.insights ?? [],
			aggregated: p.aggregated ?? '',
			imageUrl: p.imageUrl ?? null,
		})),
		photoUrls,
		aiPhotoUrls,
		matches: (matches ?? []).map((m: any) => ({
			id: m.id,
			status: m.status,
			createdAt: m.created_at,
			partnerId: m.user1_id === userId ? m.user2_id : m.user1_id,
			partnerName: partnerName.get(m.user1_id === userId ? m.user2_id : m.user1_id) ?? '—',
		})),
		recentMessages: (messages ?? []).map((m: any) => ({
			id: m.id,
			content: m.content,
			isAi: m.is_ai,
			createdAt: m.created_at,
		})),
	};
};
