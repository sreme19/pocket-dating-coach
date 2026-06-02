import type { PageServerLoad } from './$types';
import { listRoster } from '$lib/server/test-suite';

export const load: PageServerLoad = async () => {
	// Admin auth is enforced by src/routes/admin/+layout.server.ts.
	try {
		const roster = await listRoster();
		return { roster, loadError: null as string | null };
	} catch (e) {
		return { roster: [], loadError: e instanceof Error ? e.message : 'failed to load roster' };
	}
};
