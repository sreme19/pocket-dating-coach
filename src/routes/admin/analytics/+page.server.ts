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
		sb.from('verified_vibe_matches').select('id, created_at, status, user1_id, user2_id').order('created_at'),
		sb.from('verified_vibe_messages').select('created_at').order('created_at'),
		sb.from('verified_vibe_analytics').select('event_type, created_at').order('created_at'),
		sb.from('female_profiles').select('created_at, approved_for_matching'),
		sb.from('ai_bestie_feedback').select('feedback_type, created_at'),
		sb.from('vv_ai_response_timings')
			.select('*')
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
	// One row per AI reply (vv_ai_response_timings): server fills generation
	// columns, the recipient's client fills delivery/render columns. Each row
	// carries a match_id, so we label it with the two participants of that thread.
	const userName = new Map((users ?? []).map((u) => [u.id, u.first_name]));
	const matchLabel = new Map<string, string>();
	for (const m of (matches ?? []) as any[]) {
		const a = userName.get(m.user1_id) ?? 'Unknown';
		const b = userName.get(m.user2_id) ?? 'Unknown';
		matchLabel.set(m.id, `${a} ↔ ${b}`);
	}
	const aiLatency = buildAiLatency((aiTimingRows ?? []) as any[], matchLabel);

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
	matchId: string | null;
	sessionLabel: string;
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

// Delivery beyond this is staleness (history backfilled on thread (re)open),
// not delivery latency — drop it defensively so old rows can't skew the stats.
const MAX_DELIVERY_MS = 60000;

function buildAiLatency(rows: any[], matchLabel: Map<string, string>) {
	const records: AiLatencyRecord[] = rows.map((row) => {
		const waited = num(row.waited_from_user_msg_ms);
		const rawSurface = num(row.surface_ms);
		const surface = rawSurface != null && rawSurface > MAX_DELIVERY_MS ? null : rawSurface;
		const rawTotal = num(row.total_to_render_ms);
		const total = rawTotal != null && rawTotal > MAX_DELIVERY_MS ? null : rawTotal;
		const matchId = row.match_id ?? null;
		return {
			replyMessageId: row.reply_message_id ?? row.id,
			matchId,
			sessionLabel: (matchId && matchLabel.get(matchId)) || 'Unknown thread',
			responseType: row.response_type ?? 'bestie',
			at: row.generated_at ?? row.created_at ?? '',
			generationMs: num(row.generation_ms),
			claudeMs: num(row.claude_ms),
			waitedFromUserMsgMs: waited,
			surfaceMs: surface,
			renderMs: num(row.render_ms),
			totalToRenderMs: total,
			// End-to-end (user message → on screen) needs both halves.
			endToEndMs: waited != null && total != null ? waited + total : null
		};
	});

	// Already newest-first from the query, but normalize defensively.
	records.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

	// Group by chat session (match_id) — one block per thread, newest first.
	const byMatch = new Map<string, AiLatencyRecord[]>();
	for (const r of records) {
		const key = r.matchId ?? 'unknown';
		if (!byMatch.has(key)) byMatch.set(key, []);
		byMatch.get(key)!.push(r);
	}
	const sessions = [...byMatch.values()]
		.map((recs) => ({
			matchId: recs[0].matchId,
			label: recs[0].sessionLabel,
			count: recs.length,
			at: recs[0].at, // newest record in this session (records are sorted)
			stages: {
				generation: stat(recs.map((r) => r.generationMs)),
				claude: stat(recs.map((r) => r.claudeMs)),
				surface: stat(recs.map((r) => r.surfaceMs)),
				render: stat(recs.map((r) => r.renderMs)),
				endToEnd: stat(recs.map((r) => r.endToEndMs))
			},
			recent: recs.slice(0, 40)
		}))
		.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

	return {
		count: records.length,
		stages: {
			generation: stat(records.map((r) => r.generationMs)),
			claude: stat(records.map((r) => r.claudeMs)),
			surface: stat(records.map((r) => r.surfaceMs)),
			render: stat(records.map((r) => r.renderMs)),
			endToEnd: stat(records.map((r) => r.endToEndMs))
		},
		sessions,
		recent: records.slice(0, 40)
	};
}

function num(v: unknown): number | null {
	return typeof v === 'number' && isFinite(v) ? v : null;
}
