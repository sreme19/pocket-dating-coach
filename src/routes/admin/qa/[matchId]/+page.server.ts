import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getSupabase } from '$lib/server/supabase';
import { getMatchReview, saveReview, type RubricKey } from '$lib/server/qa-service';
import { REVIEWER_COOKIE } from '$lib/server/admin-auth';

export const load: PageServerLoad = async ({ params }) => {
	const review = await getMatchReview(getSupabase(), params.matchId);
	if (!review) throw error(404, 'Match not found');
	return { review };
};

const RUBRIC_KEYS: RubricKey[] = ['accuracy', 'tone', 'safety', 'helpfulness'];

export const actions: Actions = {
	save: async ({ request, params, cookies }) => {
		const reviewer = cookies.get(REVIEWER_COOKIE)?.trim();
		if (!reviewer) return fail(401, { error: 'Session expired — log in again.' });

		const form = await request.formData();

		const scores = {} as Record<RubricKey, number | null>;
		for (const k of RUBRIC_KEYS) {
			const raw = form.get(`score_${k}`);
			const n = raw ? Number(raw) : NaN;
			scores[k] = Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
		}

		const status = String(form.get('status') ?? 'reviewed');
		const comments = String(form.get('comments') ?? '');
		const flags = form.getAll('flagged').map(String).map((id) => ({
			id,
			note: String(form.get(`flagnote_${id}`) ?? '').trim()
		}));

		if (!scores.accuracy && !scores.tone && !scores.safety && !scores.helpfulness && !comments.trim() && flags.length === 0) {
			return fail(400, { error: 'Add at least one score, a comment, or a flagged message before saving.' });
		}

		const { error: err } = await saveReview(getSupabase(), {
			matchId: params.matchId,
			reviewer,
			scores,
			flags,
			comments,
			status
		});
		if (err) return fail(500, { error: `Could not save: ${err}` });

		return { saved: true };
	}
};
