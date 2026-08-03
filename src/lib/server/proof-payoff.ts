/**
 * What each un-proven category is actually worth — per proof category, not per
 * abstract dimension.
 *
 * The live what-if simulation covers identity plus four photo tags and holds appeal
 * CONSTANT by construction, hedging it with "may also raise your appeal with her if
 * she values this". So the advisor could never answer the one question that would
 * actually move someone: which upload is worth most, and by how much.
 *
 * The numbers here are absolute, which is why they are safe to state plainly:
 *
 *   Profile Strength = Σ POPULATION_AVG_WEIGHTS · v · c   (fixed weights)
 *   appeal(her)      = Σ herWeights · v · c               (one evaluator only)
 *
 * Neither is a ranking, so nobody else uploading can erode them — unlike
 * trust_score and standing, which are cohort percentiles (see the honesty rule in
 * match-intelligence.ts).
 *
 * The prediction reproduces exactly how a real vector rebuild would score the
 * upload: proof strengths ADD per dimension, clamp to 1, then
 * `c = CONFIDENCE_MIN + (1 - CONFIDENCE_MIN) * strength` (vector-builder.ts:198).
 * Predicting with a different formula than the one that will actually run is how a
 * coach ends up lying by accident.
 */

import { CONFIDENCE_MIN, ALL_DIMENSION_IDS, type DimensionId } from '$lib/verified-vibe/dimensions';
import {
	PROOF_CATEGORIES,
	missingProofCategories,
	isMoneyProofCategory,
	type ProofCategoryDef
} from '$lib/verified-vibe/proof-categories';
import { profileStrength, profileStrengthBand, appeal, type Vec } from './vector-scoring';
import { advisorVectorsEnabled } from './vector-advisor-context';

/** One evaluator whose appeal we can move — a specific match, by name. */
export interface AppealTarget {
	name: string;
	weights: Vec;
}

export interface CategoryPayoff {
	category: ProofCategoryDef;
	/** Profile Strength now → after this upload. Absolute; safe to state. */
	psBefore: number;
	psAfter: number;
	deltaPS: number;
	/** Band change, when the upload crosses a threshold. */
	bandBefore: string;
	bandAfter: string;
	crossesBand: boolean;
	/** Per-match appeal movement, biggest first. Absolute; safe to state. */
	appealGains: Array<{ name: string; before: number; after: number; delta: number }>;
	/** How many of the given matches this single upload helps at once. */
	matchesHelped: number;
	/** True when every dimension it evidences is a money dimension. */
	isMoney: boolean;
}

/** Rebuild the confidence vector as vector-builder would, given added strength. */
function confidenceFrom(strength: Record<string, number>): Vec {
	const c: Vec = {};
	for (const id of ALL_DIMENSION_IDS) {
		const s = Math.max(0, Math.min(1, strength[id] ?? 0));
		c[id] = Number((CONFIDENCE_MIN + (1 - CONFIDENCE_MIN) * s).toFixed(3));
	}
	return c;
}

function round1(n: number): number {
	return Math.round(n * 10) / 10;
}

/**
 * Rank every category this member has not yet proven by what proving it is worth.
 *
 * `currentStrength` is `vv_user_vectors.provenance.proofStrength` — the same
 * accumulator the builder uses. Passing the confidence vector instead would not
 * work: confidence is already saturated through the 0.3 floor, so you cannot tell
 * how much headroom a dimension has left.
 */
export function rankCategoryPayoffs(opts: {
	attrs: Vec;
	currentStrength: Record<string, number>;
	completedCategories: readonly string[];
	targets?: AppealTarget[];
	/** Omit money categories from the ranking entirely (see the money rule). */
	excludeMoney?: boolean;
	/** Drop ID-gated categories — the in-chat surface is picture-only. */
	excludeDocumentGated?: boolean;
	limit?: number;
}): CategoryPayoff[] {
	const {
		attrs,
		currentStrength,
		completedCategories,
		targets = [],
		excludeMoney = false,
		excludeDocumentGated = false,
		limit = 5
	} = opts;

	const baseConf = confidenceFrom(currentStrength);
	const psBefore = profileStrength(attrs, baseConf);
	const bandBefore = profileStrengthBand(psBefore);

	const candidates = missingProofCategories(completedCategories, {
		excludeMoney,
		excludeDocumentGated
	});

	const out: CategoryPayoff[] = [];

	for (const category of candidates) {
		// Apply this category's evidence on top of what is already proven.
		const next = { ...currentStrength };
		for (const [dim, s] of Object.entries(category.dims)) {
			next[dim] = (next[dim] ?? 0) + (s as number);
		}
		const nextConf = confidenceFrom(next);

		const psAfter = profileStrength(attrs, nextConf);
		const bandAfter = profileStrengthBand(psAfter);

		const appealGains = targets
			.map((t) => {
				const before = appeal(t.weights, attrs, baseConf);
				const after = appeal(t.weights, attrs, nextConf);
				return { name: t.name, before: round1(before), after: round1(after), delta: round1(after - before) };
			})
			.filter((g) => g.delta > 0)
			.sort((a, b) => b.delta - a.delta);

		out.push({
			category,
			psBefore: round1(psBefore),
			psAfter: round1(psAfter),
			deltaPS: round1(psAfter - psBefore),
			bandBefore,
			bandAfter,
			crossesBand: bandAfter !== bandBefore,
			appealGains,
			matchesHelped: appealGains.length,
			isMoney: isMoneyProofCategory(category.id)
		});
	}

	// Breadth first, then depth: an upload that lifts three people at once beats a
	// slightly bigger gain with one. Crossing a band is a genuine milestone, so it
	// outranks a marginally larger delta that lands nowhere.
	out.sort((a, b) => {
		if (b.matchesHelped !== a.matchesHelped) return b.matchesHelped - a.matchesHelped;
		if (b.crossesBand !== a.crossesBand) return b.crossesBand ? 1 : -1;
		return b.deltaPS - a.deltaPS;
	});

	return out.filter((p) => p.deltaPS > 0 || p.matchesHelped > 0).slice(0, limit);
}

/**
 * The payoff ranking as a prompt block.
 *
 * Money categories are excluded from the NAMED ranking but still counted in the
 * Profile Strength arithmetic above — the aggregate-only rule. The block states
 * plainly that these numbers are absolute, because the model is separately (and
 * correctly) told to hedge the cohort-relative ones.
 */
export function formatCategoryPayoffs(
	payoffs: CategoryPayoff[],
	opts: { subject?: 'man' | 'woman' } = {}
): string {
	if (!payoffs.length) return '';
	const poss = opts.subject === 'woman' ? 'her' : 'his';

	const lines = payoffs.map((p) => {
		const band = p.crossesBand ? ` — crosses into “${p.bandAfter}”` : '';
		const breadth = p.matchesHelped
			? ` · lifts ${poss} appeal with ${p.appealGains.map((g) => `**${g.name}** +${g.delta}`).join(', ')}`
			: '';
		return `  - ${p.category.label} (${p.category.askPhrase}): Profile Strength ${p.psBefore}→${p.psAfter} (+${p.deltaPS})${band}${breadth}`;
	});

	return `

WHAT EACH UPLOAD IS WORTH (deterministic — these are ABSOLUTE numbers, not rankings, so state them plainly; nobody else uploading can erode them):
${lines.join('\n')}
Lead with the top line. Name the single upload, say what it is worth, and make the ask concrete. Breadth beats size — "proving this lifts you with three people at once" motivates far better than a bigger number that helps one. Never present money as a draw: financial verification is an anti-fraud check only, and never appears in this list.`;
}

/** Total categories in the taxonomy, for a progress denominator. */
export const TOTAL_PROOF_CATEGORIES = PROOF_CATEGORIES.length;

// ── Advisor context block ────────────────────────────────────────────────────

/**
 * Load everything the payoff ranking needs and return a prompt block, or '' when
 * the member has no vectors yet.
 *
 * Money categories are excluded from the NAMED ranking (aggregate-only rule) and
 * ID-gated ones are kept, because the advisor tab can legitimately point someone at
 * the /proof-upload screen — it is only the in-chat picture surface that cannot.
 */
export async function loadProofPayoffContext(
	supabase: SBAny,
	userId: string,
	opts: { subject?: 'man' | 'woman' } = {}
): Promise<string> {
	if (!advisorVectorsEnabled()) return '';
	try {
		const { data: me } = await supabase
			.from('vv_user_vectors')
			.select('attributes, provenance')
			.eq('user_id', userId)
			.maybeSingle();
		if (!me?.attributes || Object.keys(me.attributes).length === 0) return '';

		const attrs = me.attributes as Vec;
		const currentStrength = (me.provenance?.proofStrength ?? {}) as Record<string, number>;

		// What is already proven, from the verification steps — the same source
		// trust-recompute reads, so the two agree on what "done" means.
		const { data: steps } = await supabase
			.from('verified_vibe_verification')
			.select('step')
			.eq('user_id', userId)
			.eq('status', 'completed')
			.like('step', 'proof_%');
		const completedCategories = ((steps ?? []) as Array<{ step: string }>).map((s) => s.step);

		// Mutual matches whose appeal this member can actually move, by name.
		const { data: matches } = await supabase
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
				supabase.from('verified_vibe_users').select('id, first_name').in('id', partnerIds),
				supabase.from('vv_user_vectors').select('user_id, weights').in('user_id', partnerIds)
			]);
			const nameOf = new Map(
				((people ?? []) as Array<{ id: string; first_name: string | null }>).map((p) => [p.id, p.first_name ?? 'Your match'])
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
			completedCategories,
			targets,
			excludeMoney: true,
			limit: 4
		});

		return formatCategoryPayoffs(payoffs, opts);
	} catch {
		return '';
	}
}

/** Generated DB types lag these tables; narrowed to this module. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SBAny = any;
