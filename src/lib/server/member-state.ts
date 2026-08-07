/**
 * member-state.ts — one definition of "is a real member".
 *
 * There are three kinds of row in verified_vibe_users:
 *
 *   seed         fabricated demo profiles (is_seed = true)
 *   provisional  anonymous visitors from the /aibestie ad landing page, who have
 *                a real auth user and a real match but have not signed up
 *   real         everyone else
 *
 * Only the third kind may appear in a count, a cohort, an alert or a pool. Before
 * this module that rule was spelled `.eq('is_seed', false)` in fifteen separate
 * queries, which was survivable while there were only two kinds of row. Adding a
 * third made it a liability: a single missed call site does not fail loudly, it
 * quietly changes a number. The two that would have hurt most:
 *
 *   · trust-normalize cohorts on real members, so provisional rows entering it
 *     would redistribute every real man's trust PERCENTILE — the same failure the
 *     photo-signal backfill already caused once.
 *   · new-member-alert reads is_seed = false as "someone signed up", so every ad
 *     click would have emailed chris@ inside five minutes.
 *
 * So the predicate lives here, once, and the call sites ask for it by name. A
 * fourth kind of row is then one edit in this file rather than another audit.
 *
 * WHY A SECOND BOOLEAN AND NOT AN ENUM. An enum (`member_state`) is the tidier
 * model and was the first plan. It also rewrites the meaning of a column that
 * fifteen live queries already depend on, on a project where migrations are run
 * by hand and several sessions share one working tree. `is_provisional` is purely
 * additive: every existing query keeps its exact current behaviour until a call
 * site opts in. The helper below is what buys back the future-proofing an enum
 * would have given — new states are added inside realMembersOnly(), not at the
 * call sites.
 */

import { env } from '$env/dynamic/private';

/**
 * Is the `is_provisional` column safe to read?
 *
 * Deploy-before-migrate is the normal sequence here (migrations are applied by
 * hand in the Supabase SQL editor), and PostgREST answers a filter on a column
 * that does not exist with a 42703 error that takes the whole query down — the
 * exact shape of the missing-migration 500s that once broke the entire chat list.
 * So every read is behind this flag, default OFF, following the
 * PHOTO_SIGNAL_GATE / GAP_BAR_GATE precedent.
 *
 * Order of operations: deploy (inert) → run 20260807100000 → set the flag.
 */
export function provisionalMembersEnabled(): boolean {
	return env.AIBESTIE_LP_GATE === 'true';
}

/**
 * Restrict a verified_vibe_users query to real members.
 *
 * Chainable: returns the same builder so it drops into an existing chain.
 *
 *   const { data } = await realMembersOnly(
 *     db.from('verified_vibe_users').select('id')
 *   ).eq('gender', 'man');
 *
 * Untyped on purpose. The generated Supabase types predate several columns on
 * this table, so the call sites already cast, and a generic signature here would
 * only move the cast rather than remove it.
 */
export function realMembersOnly(query: any): any {
	const q = query.eq('is_seed', false);
	return provisionalMembersEnabled() ? q.eq('is_provisional', false) : q;
}

/**
 * The same rule applied to a row already in memory, for the paths that filter
 * after fetching rather than in the query.
 *
 * A null `is_seed` counts as seed: the column defaults to true and only
 * upsertProfile writes an explicit false, so treating "unknown" as real would
 * quietly admit every pre-column row. A null `is_provisional` counts as NOT
 * provisional for the mirror-image reason — the column is `not null default
 * false`, so the only way to see a null is to have read a row before the
 * migration ran, and defaulting to "provisional" there would erase real members
 * from every count during the deploy window.
 */
export function isRealMemberRow(row: {
	is_seed?: boolean | null;
	is_provisional?: boolean | null;
}): boolean {
	if ((row.is_seed ?? true) !== false) return false;
	if (provisionalMembersEnabled() && row.is_provisional === true) return false;
	return true;
}

/**
 * The member-state columns to put in a `select()`, for callers that filter with
 * isRealMemberRow after fetching.
 *
 * A function rather than a constant because SELECTING a column that does not
 * exist fails exactly as hard as filtering on one — so the column name may only
 * appear once the migration has run and the flag is on.
 */
export function memberStateColumns(): string {
	return provisionalMembersEnabled() ? 'is_seed, is_provisional' : 'is_seed';
}
