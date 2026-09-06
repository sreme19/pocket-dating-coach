/**
 * READ-ONLY. Counts how populated verified_vibe_users.trust_score is.
 *
 * Answers the question blocking the full fix for ios-trust-score-inconsistent:
 * both the Discover feed and the mobile profile detail view already fetch the
 * canonical normalized trust_score and ignore it, each recomputing its own.
 * Pointing them both at the canonical column is only safe if that column is
 * actually populated — otherwise cards render 0%.
 *
 * Uses count/head:true throughout, so no member rows are returned. Nothing is
 * written.
 */

import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!) as any;

// Mirrors realMembersOnly() in src/lib/server/member-state.ts. is_provisional is
// applied unconditionally here; if the provisional flag is off in this
// environment the "real" figure is a floor, which is the safe direction.
const real = (q: any) => q.eq('is_seed', false).eq('is_provisional', false);

async function count(label: string, build: (q: any) => any) {
	const { count: n, error } = await build(
		db.from('verified_vibe_users').select('*', { count: 'exact', head: true })
	);
	if (error) {
		console.log(`${label.padEnd(46)} ERROR: ${error.message}`);
		return null;
	}
	console.log(`${label.padEnd(46)} ${n}`);
	return n as number;
}

(async () => {
	console.log('\n=== verified_vibe_users, ALL ROWS ===');
	const all = await count('total rows', (q) => q);
	const nullTrust = await count('trust_score IS NULL', (q) => q.is('trust_score', null));
	await count('trust_score = 0', (q) => q.eq('trust_score', 0));
	await count('trust_score > 0', (q) => q.gt('trust_score', 0));
	await count('trust_score > 100  (would have overflowed)', (q) => q.gt('trust_score', 100));

	console.log('\n=== REAL MEMBERS ONLY (is_seed=false, is_provisional=false) ===');
	const rAll = await count('total real members', (q) => real(q));
	const rNull = await count('trust_score IS NULL', (q) => real(q).is('trust_score', null));
	const rZero = await count('trust_score = 0', (q) => real(q).eq('trust_score', 0));
	const rPos = await count('trust_score > 0', (q) => real(q).gt('trust_score', 0));

	console.log('\n=== SUPPORTING COLUMNS (real members) ===');
	await count('raw_trust IS NULL', (q) => real(q).is('raw_trust', null));
	await count('normalized_trust IS NULL', (q) => real(q).is('normalized_trust', null));
	await count('trust_updated_at IS NULL (never normalized)', (q) =>
		real(q).is('trust_updated_at', null)
	);
	await count('identity_verified = true', (q) => real(q).eq('identity_verified', true));

	console.log('\n=== VERDICT ===');
	if (all !== null && nullTrust !== null) {
		const pct = all ? ((nullTrust / all) * 100).toFixed(1) : '0.0';
		console.log(`All rows:      ${nullTrust}/${all} null (${pct}%)`);
	}
	if (rAll !== null && rNull !== null && rPos !== null && rZero !== null) {
		const pct = rAll ? ((rNull / rAll) * 100).toFixed(1) : '0.0';
		const usable = rAll ? ((rPos / rAll) * 100).toFixed(1) : '0.0';
		console.log(`Real members:  ${rNull}/${rAll} null (${pct}%)`);
		console.log(`Real members:  ${rZero}/${rAll} zero`);
		console.log(`Real members:  ${rPos}/${rAll} with a usable score > 0 (${usable}%)`);
		console.log(
			rNull === 0 && rPos > 0
				? '\n=> Canonical column is fully populated for real members. Safe to point both surfaces at it.'
				: '\n=> Canonical column is NOT fully populated. Switching would render 0%/blank for the gap above.'
		);
	}
	console.log('');
})();
