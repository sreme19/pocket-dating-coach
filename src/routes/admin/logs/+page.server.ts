import type { PageServerLoad } from './$types';
import { getSupabase } from '$lib/server/supabase';

export const load: PageServerLoad = async ({ url }) => {
	const sb = getSupabase() as any;
	const filter = url.searchParams.get('filter') ?? 'all'; // all | error | action | navigation
	const search = url.searchParams.get('search') ?? '';
	const limit = 200;

	let query = sb
		.from('mobile_event_log')
		.select('id, user_id, event_type, screen, action, error_message, error_type, metadata, app_version, created_at')
		.order('created_at', { ascending: false })
		.limit(limit);

	if (filter !== 'all') query = query.eq('event_type', filter);
	if (search) query = query.ilike('error_message', `%${search}%`);

	const { data: logs } = await query;

	// Fetch user names for logs that have user_id
	const userIds = [...new Set((logs ?? []).map((l: any) => l.user_id).filter(Boolean))] as string[];
	const { data: users } = userIds.length
		? await sb.from('verified_vibe_users').select('id, first_name').in('id', userIds)
		: { data: [] };
	const userName = new Map((users ?? []).map((u: any) => [u.id, u.first_name]));

	return {
		logs: (logs ?? []).map((l: any) => ({
			id: l.id,
			userId: l.user_id,
			userName: l.user_id ? (userName.get(l.user_id) ?? l.user_id.slice(0, 8)) : null,
			eventType: l.event_type,
			screen: l.screen,
			action: l.action,
			errorMessage: l.error_message,
			errorType: l.error_type,
			metadata: l.metadata,
			appVersion: l.app_version,
			createdAt: l.created_at,
		})),
		filter,
		search,
	};
};
