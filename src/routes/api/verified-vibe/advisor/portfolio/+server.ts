/**
 * GET /api/verified-vibe/advisor/portfolio
 *
 * Powers the pinned Trust & Boost card at the top of the advisor thread: how much
 * of the portfolio is complete, and what the highest-value remaining uploads are
 * actually worth.
 *
 * This is the surface's whole job. The median member has completed ZERO optional
 * proof categories — only the three mandatory onboarding steps — and appeal to the
 * other side has a median of 15/100. Generic "upload more proofs" nudging has
 * demonstrably not moved that, so the card leads with one named action and the real
 * number attached to it.
 *
 * Every number returned here is ABSOLUTE and safe to state plainly: Profile Strength
 * uses fixed population weights, and appeal depends only on one evaluator's own
 * preferences. Neither is a ranking, so nobody else uploading can erode them —
 * unlike trust_score and standing, which are cohort percentiles and must be hedged
 * (see the honesty rule in match-intelligence.ts).
 *
 * Money categories are deliberately absent from `actions`: they still count toward
 * the aggregate, but must never be named to a member as something that makes them
 * more appealing (App Store guideline 1.1.4).
 *
 * Auth: Bearer token required — identity comes from the token, never a query param.
 * Response: { done, total, completed[], profileStrength?, band?, nextBand?,
 *             pointsToNextBand?, actions[] }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
import { resolveUserId } from '$lib/server/require-user';
import { resolveAssistantType } from '$lib/server/advisor-thread';
import { proofPortfolioProgress } from '$lib/verified-vibe/proof-categories';
import { rankCategoryPayoffs, type AppealTarget } from '$lib/server/proof-payoff';
import { profileStrength, profileStrengthBand, bandProgress, type Vec } from '$lib/server/vector-scoring';
import { CONFIDENCE_MIN, ALL_DIMENSION_IDS } from '$lib/verified-vibe/dimensions';

/** Rebuild confidence exactly as vector-builder does, so the card and a real
 *  rebuild can never disagree. */
function confidenceFrom(strength: Record<string, number>): Vec {
	const c: Vec = {};
	for (const id of ALL_DIMENSION_IDS) {
		const s = Math.max(0, Math.min(1, strength[id] ?? 0));
		c[id] = Number((CONFIDENCE_MIN + (1 - CONFIDENCE_MIN) * s).toFixed(3));
	}
	return c;
}

export const GET: RequestHandler = async ({ request }) => {
	try {
		const userId = await resolveUserId(request);
		if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const sb = getSupabase() as any;
		const assistantType = await resolveAssistantType(getSupabase(), userId);

		// What is already proven — the same source trust-recompute reads, so the card
		// and the score agree on what "done" means.
		const { data: steps } = await sb
			.from('verified_vibe_verification')
			.select('step')
			.eq('user_id', userId)
			.eq('status', 'completed')
			.like('step', 'proof_%');
		const completed = ((steps ?? []) as Array<{ step: string }>).map((s) =>
			s.step.replace(/^proof_/, '')
		);

		const progress = proofPortfolioProgress(completed);

		// Vectors are optional: a member who has not been built yet still gets a
		// meaningful completion count, just no predicted deltas.
		const { data: me } = await sb
			.from('vv_user_vectors')
			.select('attributes, provenance')
			.eq('user_id', userId)
			.maybeSingle();

		const attrs = (me?.attributes ?? null) as Vec | null;
		if (!attrs || Object.keys(attrs).length === 0) {
			return json({ done: progress.done, total: progress.total, completed, actions: [] });
		}

		const currentStrength = (me?.provenance?.proofStrength ?? {}) as Record<string, number>;
		const conf = confidenceFrom(currentStrength);
		const ps = profileStrength(attrs, conf);
		const prog = bandProgress(ps);

		// Matches whose appeal this member can actually move, by name.
		const { data: matches } = await sb
			.from('verified_vibe_matches')
			.select('user1_id, user2_id')
			.or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
			.eq('status', 'mutual');
		const partnerIds = ((matches ?? []) as Array<{ user1_id: string; user2_id: string }>).map((m) =>
			m.user1_id === userId ? m.user2_id : m.user1_id
		);

		const targets: AppealTarget[] = [];
		if (partnerIds.length) {
			const [{ data: people }, { data: vecs }] = await Promise.all([
				sb.from('verified_vibe_users').select('id, first_name').in('id', partnerIds),
				sb.from('vv_user_vectors').select('user_id, weights').in('user_id', partnerIds)
			]);
			const nameOf = new Map(
				((people ?? []) as Array<{ id: string; first_name: string | null }>).map((p) => [
					p.id,
					p.first_name ?? 'Your match'
				])
			);
			for (const v of (vecs ?? []) as Array<{ user_id: string; weights: Vec }>) {
				if (v.weights && Object.keys(v.weights).length) {
					targets.push({ name: nameOf.get(v.user_id) ?? 'Your match', weights: v.weights });
				}
			}
		}

		const payoffs = rankCategoryPayoffs({
			attrs,
			currentStrength,
			completedCategories: completed,
			targets,
			// Money feeds the aggregate but is never NAMED as a draw.
			excludeMoney: true,
			limit: 4
		});

		return json({
			done: progress.done,
			total: progress.total,
			completed,
			assistantType,
			profileStrength: Math.round(ps * 10) / 10,
			band: profileStrengthBand(ps),
			nextBand: prog.nextBand ?? null,
			pointsToNextBand: prog.pointsToNextBand ?? null,
			actions: payoffs.map((p) => ({
				id: p.category.id,
				label: p.category.label,
				askPhrase: p.category.askPhrase,
				deltaPS: p.deltaPS,
				crossesBand: p.crossesBand,
				bandAfter: p.bandAfter,
				appealGains: p.appealGains.map((g) => ({ name: g.name, delta: g.delta })),
				matchesHelped: p.matchesHelped
			}))
		});
	} catch (error) {
		console.error('[advisor portfolio]', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
