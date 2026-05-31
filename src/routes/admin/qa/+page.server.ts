import type { PageServerLoad } from './$types';
import { getSupabase } from '$lib/server/supabase';
import { listReviewQueue } from '$lib/server/qa-service';

export const load: PageServerLoad = async () => {
	const queue = await listReviewQueue(getSupabase());
	return { queue };
};
