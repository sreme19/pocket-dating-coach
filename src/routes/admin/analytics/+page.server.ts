import type { PageServerLoad } from './$types';
import { getSupabase } from '$lib/server/supabase';

export const load: PageServerLoad = async () => {
	const sb = getSupabase();


	const [
		{ data: users },
		{ data: likes },
		{ data: passes },
		{ data: matches },
		{ data: messages },
		{ data: analytics },
		{ data: femaleFunnel },
		{ data: bestie },
	] = await Promise.all([
		sb.from('verified_vibe_users').select('id, first_name, age, city, gender, archetype, trust_score, is_seed, created_at').order('created_at', { ascending: false }),
		sb.from('verified_vibe_likes').select('created_at').order('created_at'),
		sb.from('verified_vibe_passes').select('created_at').order('created_at'),
		sb.from('verified_vibe_matches').select('created_at, status').order('created_at'),
		sb.from('verified_vibe_messages').select('created_at').order('created_at'),
		sb.from('verified_vibe_analytics').select('event_type, created_at').order('created_at'),
		sb.from('female_profiles').select('created_at, approved_for_matching'),
		sb.from('ai_bestie_feedback').select('feedback_type, created_at'),
	]);

	// Signups per day (last 30 days)
	const signupsByDay = bucketByDay(users ?? [], 30);

	// Gender split
	const genderCounts = countBy(users ?? [], (u) => u.gender);

	// Archetype distribution (top 8)
	const archetypeCounts = countBy(users ?? [], (u) => u.archetype);
	const topArchetypes = Object.entries(archetypeCounts)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 8);

	// Trust score distribution (buckets: 0-20, 21-40, 41-60, 61-80, 81-100)
	const trustBuckets = [0, 0, 0, 0, 0];
	for (const u of users ?? []) {
		const idx = Math.min(Math.floor((u.trust_score ?? 0) / 20), 4);
		trustBuckets[idx]++;
	}

	// Engagement per day (likes + passes last 30 days)
	const likesByDay = bucketByDay(likes ?? [], 30);
	const passesByDay = bucketByDay(passes ?? [], 30);

	// Match rate
	const totalMatches = matches?.length ?? 0;
	const mutualMatches = matches?.filter((m) => m.status === 'mutual').length ?? 0;

	// Messages per day (last 30 days)
	const messagesByDay = bucketByDay(messages ?? [], 30);

	// Event type breakdown
	const eventCounts = countBy(analytics ?? [], (e) => e.event_type);

	// Female profile funnel
	const totalFemale = femaleFunnel?.length ?? 0;
	const approvedFemale = femaleFunnel?.filter((f) => f.approved_for_matching).length ?? 0;

	// AI Bestie feedback types
	const bestieTypes = countBy(bestie ?? [], (b) => b.feedback_type);

	// Totals
	const totals = {
		users: users?.length ?? 0,
		likes: likes?.length ?? 0,
		passes: passes?.length ?? 0,
		matches: totalMatches,
		mutualMatches,
		messages: messages?.length ?? 0,
		femaleProfiles: totalFemale,
		approvedFemale,
	};

	return {
		totals,
		signupsByDay,
		genderCounts,
		topArchetypes,
		trustBuckets,
		likesByDay,
		passesByDay,
		messagesByDay,
		eventCounts,
		bestieTypes,
		userList: (users ?? []).map((u) => ({
			id: u.id,
			name: u.first_name,
			age: u.age,
			city: u.city,
			gender: u.gender,
			archetype: u.archetype,
			trustScore: u.trust_score,
			joinedAt: u.created_at,
			isSeed: u.is_seed ?? true,
		})),
	};
};

function bucketByDay(rows: { created_at: string }[], days: number) {
	const labels: string[] = [];
	const counts: number[] = [];
	const now = new Date();
	for (let i = days - 1; i >= 0; i--) {
		const d = new Date(now);
		d.setDate(d.getDate() - i);
		const label = d.toISOString().slice(0, 10);
		labels.push(label);
		counts.push(rows.filter((r) => r.created_at?.slice(0, 10) === label).length);
	}
	return { labels, counts };
}

function countBy<T>(rows: T[], key: (r: T) => string): Record<string, number> {
	const out: Record<string, number> = {};
	for (const r of rows) {
		const k = key(r) ?? 'unknown';
		out[k] = (out[k] ?? 0) + 1;
	}
	return out;
}
