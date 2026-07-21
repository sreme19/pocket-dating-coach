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
		{ data: verifySteps },
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
		sb.from('verified_vibe_verification').select('user_id, step, status'),
	]);

	// Emails live in Supabase Auth (keyed by the same id as verified_vibe_users),
	// not on the profile table. The bulk admin listUsers endpoint is broken on this
	// project (returns a 500 "Database error finding users"), so resolve each id
	// individually via getUserById — which works — in small concurrent batches.
	const emailById = new Map<string, string>();
	const userIds = (users ?? []).map((u) => u.id);
	const EMAIL_BATCH = 10;
	for (let i = 0; i < userIds.length; i += EMAIL_BATCH) {
		const batch = userIds.slice(i, i + EMAIL_BATCH);
		await Promise.all(
			batch.map(async (id) => {
				const { data: au } = await sb.auth.admin.getUserById(id);
				if (au?.user?.email) emailById.set(id, au.user.email);
			})
		);
	}

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
	// Pull the AI reply text for each timing row so the latency table can show
	// which message each measurement belongs to.
	const replyIds = [...new Set((aiTimingRows ?? []).map((r: any) => r.reply_message_id).filter(Boolean))];
	const replyContent = new Map<string, string>();
	if (replyIds.length) {
		const { data: replyMsgs } = await sb
			.from('verified_vibe_messages')
			.select('id, content')
			.in('id', replyIds);
		for (const m of (replyMsgs ?? []) as any[]) replyContent.set(m.id, m.content);
	}
	// AI Wingman advisor replies aren't stored as message rows — their text lives
	// in the advisor transcript, stamped with the same latency join key. Pull those
	// in so wingman rows show their message text just like Bestie rows do.
	const { data: advisorChats } = await sb
		.from('ai_assistant_advisor_chats')
		.select('messages')
		.eq('assistant_type', 'wingman');
	for (const chat of (advisorChats ?? []) as any[]) {
		for (const m of (chat.messages ?? []) as any[]) {
			if (m?.id && m?.content && !replyContent.has(m.id)) replyContent.set(m.id, m.content);
		}
	}
	const aiLatency = buildAiLatency((aiTimingRows ?? []) as any[], matchLabel, replyContent, userName);

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

	// Build trust score per user using the same formula as the mobile app
	const PROOF_PTS: Record<string, number> = {
		lifestyle: 8, hosting: 6, discipline: 4, social_proof: 4,
		linkedin: 5, instagram: 3, twitter: 2, habit_tracker: 2,
		intro: 8, spending: 10, assets: 10, wealth: 12, travel: 8,
	};
	const stepsByUser = new Map<string, { step: string; status: string }[]>();
	for (const s of verifySteps ?? []) {
		if (!stepsByUser.has(s.user_id)) stepsByUser.set(s.user_id, []);
		stepsByUser.get(s.user_id)!.push(s);
	}
	function calcTrust(userId: string): number {
		const steps = stepsByUser.get(userId) ?? [];
		const done = (name: string) => steps.some((s) => s.step === name && s.status === 'completed');
		const vPts = (done('id') ? 10 : 0) + (done('liveness') ? 10 : 0)
		           + (done('photos') ? 15 : 0) + (done('spending_or_qa') ? 10 : 0);
		let proofPts = 0;
		for (const s of steps) {
			if (s.step.startsWith('proof_') && s.status === 'completed') {
				proofPts += PROOF_PTS[s.step.replace('proof_', '')] ?? 4;
			}
		}
		return Math.min(vPts + proofPts, 100);
	}

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
			email: emailById.get(u.id) ?? null,
			age: u.age,
			city: u.city,
			gender: u.gender,
			archetype: u.archetype,
			trustScore: calcTrust(u.id),
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
	content: string | null; // the AI reply text this measurement belongs to
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

function buildAiLatency(
	rows: any[],
	matchLabel: Map<string, string>,
	replyContent: Map<string, string>,
	userName: Map<string, string>
) {
	// Drop render-only orphans: rows with no server-side generation half
	// (generation_ms IS NULL). These are client render pings for AI messages
	// that predate server timing — backfilled on thread (re)open — and only
	// clutter the table with 1ms-render, everything-else-blank rows.
	const measured = rows.filter((row) => num(row.generation_ms) != null);

	const records: AiLatencyRecord[] = measured.map((row) => {
		const waited = num(row.waited_from_user_msg_ms);
		const rawSurface = num(row.surface_ms);
		const surface = rawSurface != null && rawSurface > MAX_DELIVERY_MS ? null : rawSurface;
		const rawTotal = num(row.total_to_render_ms);
		const total = rawTotal != null && rawTotal > MAX_DELIVERY_MS ? null : rawTotal;
		const matchId = row.match_id ?? null;
		const responseType = row.response_type ?? 'bestie';
		// Wingman advisor chats have no match — match_id holds the man's user id, so
		// all his replies group into one "AI Wingman ↔ <name>" session. Bestie rows
		// label by the two thread participants as before.
		const sessionLabel = responseType === 'wingman'
			? `AI Wingman ↔ ${(matchId && userName.get(matchId)) || 'Unknown'}`
			: (matchId && matchLabel.get(matchId)) || 'Unknown thread';
		return {
			replyMessageId: row.reply_message_id ?? row.id,
			matchId,
			sessionLabel,
			responseType,
			content: replyContent.get(row.reply_message_id ?? row.id) ?? null,
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
