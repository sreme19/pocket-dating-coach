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
		{ data: likesGiven },
		{ data: likesReceived },
		{ data: passesSent },
		{ data: tips },
		{ data: aiConvos },
		{ data: { user: authUser } },
	] = await Promise.all([
		sb.from('verified_vibe_users').select('*').eq('id', userId).single(),
		sb.from('user_master_profile').select('data').eq('user_id', userId).maybeSingle(),
		sb.from('verified_vibe_verification').select('*').eq('user_id', userId),
		sb.from('vv_ai_photo_jobs').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
		sb.from('verified_vibe_matches')
			.select('id, status, created_at, user1_id, user2_id')
			.or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
			.order('created_at', { ascending: false }),
		sb.from('verified_vibe_likes').select('liked_user_id, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
		sb.from('verified_vibe_likes').select('user_id, created_at').eq('liked_user_id', userId).order('created_at', { ascending: false }),
		sb.from('verified_vibe_passes').select('passed_user_id, reason, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
		sb.from('profile_tips').select('tip_tags, created_at').eq('target_user_id', userId).order('created_at', { ascending: false }),
		sb.from('ai_assistant_conversations')
			.select('id, match_conversation_id, assistant_type, messages, exchange_count, updated_at')
			.eq('user_id', userId)
			.order('updated_at', { ascending: false }),
		sb.auth.admin.getUserById(userId),
	]);

	if (!user) throw error(404, 'User not found');

	const masterData = (master?.data ?? {}) as Record<string, any>;
	const verifiedProofs: any[] = Array.isArray(masterData.verifiedProofs) ? masterData.verifiedProofs : [];
	const { PUBLIC_SUPABASE_URL } = await import('$env/static/public');

	// Collect all photo URLs — master profile uses `photos[].dataUrl`
	const seen = new Set<string>();
	const photoUrls: { url: string; label: string }[] = [];
	function addPhoto(url: string | null | undefined, label: string) {
		if (!url || seen.has(url)) return;
		seen.add(url);
		photoUrls.push({ url, label });
	}

	// Selfie from liveness step
	const livenessStep = (verification ?? []).find((v: any) => v.step === 'liveness');
	const selfiePath: string | null = livenessStep?.data?.anchorSelfiePath ?? null;
	if (selfiePath) addPhoto(`${PUBLIC_SUPABASE_URL}/storage/v1/object/public/profiles/${selfiePath}`, 'Selfie (liveness)');

	// Profile photos from master profile
	const masterPhotos: any[] = Array.isArray(masterData.photos) ? masterData.photos : [];
	for (const p of masterPhotos) {
		addPhoto(p?.dataUrl ?? p?.url, p?.label ? `Photo (${p.label})` : 'Photo');
	}

	// Avatar fallback
	addPhoto(user.avatar_url, 'Avatar');

	// Proof images
	for (const proof of verifiedProofs) {
		addPhoto(proof?.imageUrl, `Proof: ${proof.category ?? ''}`);
		addPhoto(proof?.documentUrl, `Doc: ${proof.category ?? ''}`);
	}

	// AI generated photos from master profile
	const aiPhotoUrls: { url: string; label: string; status: string }[] = [];
	const masterAiPhotos: any[] = Array.isArray(masterData.aiPhotos) ? masterData.aiPhotos : [];
	for (const p of masterAiPhotos) {
		if (p?.url) aiPhotoUrls.push({ url: p.url, label: p.scene ?? p.role ?? 'AI photo', status: 'generated' });
	}
	// Also check vv_ai_photo_jobs as fallback
	for (const job of aiPhotos ?? []) {
		const photos: any[] = Array.isArray(job.ai_photos) ? job.ai_photos : [];
		for (const p of photos) {
			if (p?.url && !aiPhotoUrls.find(x => x.url === p.url)) {
				aiPhotoUrls.push({ url: p.url, label: 'AI photo', status: job.status ?? '' });
			}
		}
	}

	// Match partners — fetch their names
	const matchList = matches ?? [];
	const partnerIds = matchList.map((m: any) =>
		m.user1_id === userId ? m.user2_id : m.user1_id
	);
	const { data: partners } = partnerIds.length
		? await sb.from('verified_vibe_users').select('id, first_name').in('id', partnerIds)
		: { data: [] };
	const partnerName = new Map((partners ?? []).map((p: any) => [p.id, p.first_name]));

	// Fetch all messages across all matches (grouped by match_id)
	const matchIds = matchList.map((m: any) => m.id);
	let allMessages: any[] = [];
	if (matchIds.length > 0) {
		const { data: msgs } = await sb
			.from('verified_vibe_messages')
			.select('id, match_id, content, sender_id, is_ai, created_at')
			.in('match_id', matchIds)
			.order('created_at', { ascending: true });
		allMessages = msgs ?? [];
	}

	const messagesByMatch = new Map<string, any[]>();
	for (const msg of allMessages) {
		if (!messagesByMatch.has(msg.match_id)) messagesByMatch.set(msg.match_id, []);
		messagesByMatch.get(msg.match_id)!.push(msg);
	}

	// Aggregate tips
	const tipTagCounts: Record<string, number> = {};
	for (const t of tips ?? []) {
		for (const tag of t.tip_tags ?? []) {
			tipTagCounts[tag] = (tipTagCounts[tag] ?? 0) + 1;
		}
	}
	const tipsSummary = Object.entries(tipTagCounts)
		.sort(([, a], [, b]) => b - a)
		.map(([tag, count]) => ({ tag, count }));

	// Resolve liked/passed user names
	const allExternalIds = [
		...(likesGiven ?? []).map((l: any) => l.liked_user_id),
		...(likesReceived ?? []).map((l: any) => l.user_id),
		...(passesSent ?? []).map((p: any) => p.passed_user_id),
	].filter(Boolean);
	const uniqueExternalIds = [...new Set(allExternalIds as string[])];
	const { data: externalUsers } = uniqueExternalIds.length
		? await sb.from('verified_vibe_users').select('id, first_name').in('id', uniqueExternalIds)
		: { data: [] };
	const externalName = new Map((externalUsers ?? []).map((u: any) => [u.id, u.first_name]));

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
			about: masterData.generatedProfile?.about ?? user.about ?? null,
			looking: user.looking,
			createdAt: user.created_at,
			avatarUrl: user.avatar_url,
			email: authUser?.email ?? user.email ?? null,
			phone: authUser?.phone ?? user.phone ?? null,
			deletedAt: user.deleted_at ?? null,
			isBanned: !!(authUser?.banned_until && new Date(authUser.banned_until) > new Date()),
		},
		qaAnswers: (() => {
			const responses = (verification ?? []).find((v: any) => v.step === 'spending_or_qa')?.data?.responses ?? null;
			if (!responses) return null;
			const out: { section: string; items: string[] }[] = [];
			for (const [key, val] of Object.entries(responses as Record<string, any>)) {
				const items = Array.isArray(val) ? val : Object.values(val as any).flat();
				if (items.length) out.push({ section: key.replace(/_/g, ' '), items: items as string[] });
			}
			return out;
		})(),
		masterData: {
			onboarding: masterData.onboarding ?? {},
			generatedProfile: masterData.generatedProfile ?? null,
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
		matches: matchList.map((m: any) => {
			const pid = m.user1_id === userId ? m.user2_id : m.user1_id;
			const msgs = messagesByMatch.get(m.id) ?? [];
			return {
				id: m.id,
				status: m.status,
				createdAt: m.created_at,
				partnerId: pid,
				partnerName: partnerName.get(pid) ?? '—',
				messages: msgs.map((msg: any) => ({
					id: msg.id,
					content: msg.content,
					senderIsMe: msg.sender_id === userId,
					isAi: msg.is_ai,
					createdAt: msg.created_at,
				})),
			};
		}),
		activity: {
			likesGiven: (likesGiven ?? []).length,
			likesReceived: (likesReceived ?? []).length,
			passesSent: (passesSent ?? []).length,
			recentLikesGiven: (likesGiven ?? []).slice(0, 10).map((l: any) => ({
				name: externalName.get(l.liked_user_id) ?? '—',
				createdAt: l.created_at,
			})),
			recentLikesReceived: (likesReceived ?? []).slice(0, 10).map((l: any) => ({
				name: externalName.get(l.user_id) ?? '—',
				createdAt: l.created_at,
			})),
			recentPasses: (passesSent ?? []).slice(0, 10).map((p: any) => ({
				name: externalName.get(p.passed_user_id) ?? '—',
				reason: p.reason,
				createdAt: p.created_at,
			})),
		},
		tips: {
			totalReceived: (tips ?? []).length,
			summary: tipsSummary,
		},
		aiConversations: (aiConvos ?? []).map((c: any) => {
			const msgs: any[] = Array.isArray(c.messages) ? c.messages : [];
			return {
				id: c.id,
				matchConversationId: c.match_conversation_id,
				assistantType: c.assistant_type,
				exchangeCount: c.exchange_count ?? 0,
				updatedAt: c.updated_at,
				lastFewMessages: msgs.slice(-6).map((m: any) => ({
					role: m.role ?? '?',
					content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
				})),
			};
		}),
	};
};
