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
		{ data: aiTimingRows },
	] = await Promise.all([
		sb.from('verified_vibe_users').select('id, first_name, age, city, gender, archetype, trust_score, is_seed, created_at').order('created_at', { ascending: false }),
		sb.from('verified_vibe_likes').select('created_at').order('created_at'),
		sb.from('verified_vibe_passes').select('created_at').order('created_at'),
		sb.from('verified_vibe_matches').select('created_at, status').order('created_at'),
		sb.from('verified_vibe_messages').select('created_at').order('created_at'),
		sb.from('verified_vibe_analytics').select('event_type, created_at').order('created_at'),
		sb.from('female_profiles').select('created_at, approved_for_matching'),
		sb.from('ai_bestie_feedback').select('feedback_type, created_at'),
		sb.from('verified_vibe_analytics')
			.select('event_type, metadata, created_at')
			.in('event_type', ['ai_response_timing', 'ai_response_rendered'])
			.order('created_at', { ascending: false })
			.limit(2000),
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

	// ── AI response latency ───────────────────────────────────────────────────
	// Join server-side generation timing with client-side delivery/render timing
	// (both logged to verified_vibe_analytics) on replyMessageId.
	const aiLatency = buildAiLatency(aiTimingRows ?? []);

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
		aiLatency,
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

interface AiLatencyRecord {
	replyMessageId: string;
	responseType: string;
	at: string; // when the response was generated (or logged, as fallback)
	generationMs: number | null;
	claudeMs: number | null;
	waitedFromUserMsgMs: number | null;
	surfaceMs: number | null;
	renderMs: number | null;
	totalToRenderMs: number | null;
	endToEndMs: number | null; // user message → painted on screen
}

interface LatencyStat {
	n: number;
	avg: number | null;
	p50: number | null;
	p95: number | null;
	max: number | null;
}

function stat(values: (number | null)[]): LatencyStat {
	const nums = values.filter((v): v is number => typeof v === 'number' && isFinite(v)).sort((a, b) => a - b);
	if (nums.length === 0) return { n: 0, avg: null, p50: null, p95: null, max: null };
	const pct = (p: number) => nums[Math.min(nums.length - 1, Math.floor((p / 100) * nums.length))];
	const avg = Math.round(nums.reduce((s, v) => s + v, 0) / nums.length);
	return { n: nums.length, avg, p50: pct(50), p95: pct(95), max: nums[nums.length - 1] };
}

function buildAiLatency(rows: { event_type: string; metadata: any; created_at: string }[]) {
	// Merge the two event types by replyMessageId.
	const byId = new Map<string, AiLatencyRecord>();
	const get = (id: string): AiLatencyRecord => {
		let r = byId.get(id);
		if (!r) {
			r = {
				replyMessageId: id,
				responseType: 'bestie',
				at: '',
				generationMs: null,
				claudeMs: null,
				waitedFromUserMsgMs: null,
				surfaceMs: null,
				renderMs: null,
				totalToRenderMs: null,
				endToEndMs: null
			};
			byId.set(id, r);
		}
		return r;
	};

	for (const row of rows) {
		const m = row.metadata ?? {};
		const id: string | null = m.replyMessageId ?? null;
		if (!id) continue;
		const rec = get(id);
		if (m.responseType) rec.responseType = m.responseType;
		if (row.event_type === 'ai_response_timing') {
			rec.generationMs = num(m.generationMs);
			rec.claudeMs = num(m.claudeMs);
			rec.waitedFromUserMsgMs = num(m.waitedFromUserMsgMs);
			rec.at = m.generatedAt ?? row.created_at;
		} else if (row.event_type === 'ai_response_rendered') {
			rec.surfaceMs = num(m.surfaceMs);
			rec.renderMs = num(m.renderMs);
			rec.totalToRenderMs = num(m.totalToRenderMs);
			if (!rec.at) rec.at = m.generatedAt ?? row.created_at;
		}
	}

	// Derive end-to-end (user message → on screen) where both halves are known.
	const records = [...byId.values()];
	for (const r of records) {
		if (r.waitedFromUserMsgMs != null && r.totalToRenderMs != null) {
			r.endToEndMs = r.waitedFromUserMsgMs + r.totalToRenderMs;
		}
	}
	// Newest first.
	records.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

	return {
		count: records.length,
		stages: {
			generation: stat(records.map((r) => r.generationMs)),
			claude: stat(records.map((r) => r.claudeMs)),
			surface: stat(records.map((r) => r.surfaceMs)),
			render: stat(records.map((r) => r.renderMs)),
			endToEnd: stat(records.map((r) => r.endToEndMs))
		},
		recent: records.slice(0, 40)
	};
}

function num(v: unknown): number | null {
	return typeof v === 'number' && isFinite(v) ? v : null;
}
