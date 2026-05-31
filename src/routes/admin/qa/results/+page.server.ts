import type { PageServerLoad } from './$types';
import { getSupabase } from '$lib/server/supabase';
import { getQaStats } from '$lib/server/qa-service';

export const load: PageServerLoad = async () => {
	const stats = await getQaStats(getSupabase());
	return { stats };
};
