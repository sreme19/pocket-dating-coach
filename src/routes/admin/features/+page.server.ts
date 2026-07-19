import type { PageServerLoad } from './$types';
import { getSupabase } from '$lib/server/supabase';

/**
 * Feature Usage — which Verified Vibe features are actually used, and which are
 * ignored. Derived live from the domain tables (every one keyed by
 * verified_vibe_users.id, so the gender + seed filters apply naturally), plus a
 * proof-upload open→upload funnel drawn from the mobile app's event log.
 *
 * Filters (URL query, so a change just re-runs this load):
 *   days   = 7 | 30 | 90        (default 30)
 *   gender = all | man | woman  (default all)
 *   seed   = exclude | include  (default exclude — real users only)
 */

const ALLOWED_DAYS = [7, 30, 90];

type Filter = { days: number; gender: 'all' | 'man' | 'woman'; seed: 'exclude' | 'include' };
type UserMeta = { gender: string; is_seed: boolean };
type Ev = { user: string | null; at: string };

export const load: PageServerLoad = async ({ url }) => {
	const sb = getSupabase();

	// ── Parse filters ───────────────────────────────────────────────────────────
	const daysParam = Number(url.searchParams.get('days'));
	const days = ALLOWED_DAYS.includes(daysParam) ? daysParam : 30;
	const genderParam = url.searchParams.get('gender');
	const gender = (genderParam === 'man' || genderParam === 'woman' ? genderParam : 'all') as Filter['gender'];
	const seed = (url.searchParams.get('seed') === 'include' ? 'include' : 'exclude') as Filter['seed'];
	const filter: Filter = { days, gender, seed };
	const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

	// ── User map (id → gender / seed) drives every filter + the pct denominator ──
	const { data: users } = await sb.from('verified_vibe_users').select('id, gender, is_seed').limit(100000);
	const userMap = new Map<string, UserMeta>();
	for (const u of (users ?? []) as { id: string; gender: string; is_seed: boolean | null }[]) {
		userMap.set(u.id, { gender: u.gender, is_seed: u.is_seed ?? false });
	}
	const passUser = (id: string | null): boolean => {
		if (!id) return false;
		const m = userMap.get(id);
		if (!m) return false; // unknown id can't be classified — exclude from filtered views
		if (gender !== 'all' && m.gender !== gender) return false;
		if (seed === 'exclude' && m.is_seed) return false;
		return true;
	};

	// Addressable base = users matching the current gender/seed filter.
	let base = 0;
	for (const m of userMap.values()) {
		if (gender !== 'all' && m.gender !== gender) continue;
		if (seed === 'exclude' && m.is_seed) continue;
		base++;
	}

	// ── Fetch each feature's raw events within the window ────────────────────────
	const [
		likes,
		passes,
		messages,
		matches,
		advisor,
		attention,
		verification,
		proofEvents
	] = await Promise.all([
		sb.from('verified_vibe_likes').select('user_id, created_at').gte('created_at', since).limit(100000),
		sb.from('verified_vibe_passes').select('user_id, created_at').gte('created_at', since).limit(100000),
		sb.from('verified_vibe_messages').select('sender_id, created_at, is_ai').gte('created_at', since).limit(100000),
		sb.from('verified_vibe_matches').select('user1_id, user2_id, created_at').gte('created_at', since).limit(100000),
		sb.from('ai_assistant_advisor_chats').select('user_id, assistant_type, created_at').gte('created_at', since).limit(100000),
		sb.from('attention_messages').select('sender_id, created_at').gte('created_at', since).limit(100000),
		sb.from('verified_vibe_verification').select('user_id, step, created_at').gte('created_at', since).limit(100000),
		sb
			.from('mobile_event_log')
			.select('user_id, event_type, action, metadata, created_at')
			.eq('screen', 'proof_upload')
			.gte('created_at', since)
			.order('created_at', { ascending: true })
			.limit(100000)
	]);

	const asEv = (rows: any[] | null, idKey: string): Ev[] =>
		(rows ?? []).map((r) => ({ user: r[idKey] ?? null, at: r.created_at }));

	// Matches → one engagement row per participant.
	const matchEvents: Ev[] = [];
	for (const m of (matches.data ?? []) as any[]) {
		if (m.user1_id) matchEvents.push({ user: m.user1_id, at: m.created_at });
		if (m.user2_id) matchEvents.push({ user: m.user2_id, at: m.created_at });
	}
	const advisorRows = (advisor.data ?? []) as any[];
	const verifRows = (verification.data ?? []) as any[];

	const features = [
		feat('likes', 'Likes sent', 'Discovery', asEv(likes.data, 'user_id')),
		feat('passes', 'Passes', 'Discovery', asEv(passes.data, 'user_id')),
		feat(
			'messages',
			'Chat messaging',
			'Messaging',
			// Exclude AI-authored messages — we want human feature use.
			asEv((messages.data ?? []).filter((m: any) => m.is_ai !== true), 'sender_id')
		),
		feat('matches', 'Matches', 'Discovery', matchEvents),
		feat('bestie', 'AI Bestie', 'AI Coach', asEv(advisorRows.filter((r) => r.assistant_type === 'bestie'), 'user_id')),
		feat('wingman', 'AI Wingman', 'AI Coach', asEv(advisorRows.filter((r) => r.assistant_type === 'wingman'), 'user_id')),
		feat('attention', 'Attention / Promote', 'Messaging', asEv(attention.data, 'sender_id')),
		feat('verification', 'Verification steps', 'Onboarding', asEv(verifRows.filter((r) => !String(r.step).startsWith('proof_')), 'user_id')),
		feat('proof', 'Proof upload', 'Trust & Safety', asEv(verifRows.filter((r) => String(r.step).startsWith('proof_')), 'user_id'))
	].sort((a, b) => b.pct - a.pct);

	// ── Proof funnel drill-down (mobile events; date-filtered only) ──────────────
	const proof = buildProofFunnel((proofEvents.data ?? []) as any[], verifRows, days);

	// Helper closures capture `passUser`, `base`, `days`, `since` — declared below.
	function feat(key: string, name: string, group: string, events: Ev[]) {
		const kept = events.filter((e) => passUser(e.user));
		const uses = kept.length;
		const userSet = new Set(kept.map((e) => e.user));
		const usersCount = userSet.size;
		const pct = base > 0 ? (usersCount / base) * 100 : 0;
		const tier = pct >= 30 ? 'good' : pct >= 5 ? 'warn' : 'crit';
		let last: string | null = null;
		for (const e of kept) if (!last || e.at > last) last = e.at;
		return { key, name, group, uses, users: usersCount, pct: round1(pct), tier, lastUsed: last, spark: bucket(kept, days) };
	}

	return {
		filter,
		base,
		totalUsers: userMap.size,
		features,
		proof,
		generatedAt: new Date().toISOString()
	};
};

function round1(n: number) {
	return Math.round(n * 10) / 10;
}

function bucket(events: Ev[], days: number): number[] {
	const out = new Array(days).fill(0);
	const now = new Date();
	const start = new Date(now);
	start.setDate(start.getDate() - (days - 1));
	start.setHours(0, 0, 0, 0);
	for (const e of events) {
		const d = new Date(e.at);
		const idx = Math.floor((d.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
		if (idx >= 0 && idx < days) out[idx]++;
	}
	return out;
}

function buildProofFunnel(rows: any[], verifRows: any[], days: number) {
	const opened = rows.filter((r) => r.event_type === 'navigation');
	const started = rows.filter((r) => r.event_type === 'action' && (r.action === 'upload_proof' || r.action === 'submit_proof'));
	const results = rows.filter((r) => r.event_type === 'action' && r.action === 'proof_result');
	const verified = results.filter((r) => r.metadata?.verified === true);

	const stage = (label: string, sub: string, arr: any[], prev: any[] | null) => ({
		label,
		sub,
		count: arr.length,
		users: new Set(arr.map((r) => r.user_id).filter(Boolean)).size,
		conv: prev && prev.length ? Math.round((arr.length / prev.length) * 100) : null
	});

	const funnel = [
		stage('Opened proof screen', 'viewed the "Add a proof" page', opened, null),
		stage('Started an upload', 'tapped upload / connect', started, opened),
		stage('Completed an upload', 'submitted and got a result back', results, started),
		stage('Verified', 'proof passed AI verification', verified, results)
	];

	const openedCount = opened.length;
	const uploadedCount = results.length;
	const bailed = Math.max(0, openedCount - uploadedCount);
	const bailPct = openedCount ? Math.round((bailed / openedCount) * 100) : 0;

	// Per-category from proof_result events (empty until the mobile build ships).
	const catMap = new Map<string, { attempts: number; verified: number }>();
	for (const r of results) {
		const cat = String(r.metadata?.category ?? 'unknown');
		const c = catMap.get(cat) ?? { attempts: 0, verified: 0 };
		c.attempts++;
		if (r.metadata?.verified === true) c.verified++;
		catMap.set(cat, c);
	}
	const categories = [...catMap.entries()]
		.map(([cat, c]) => ({ cat, attempts: c.attempts, verified: c.verified, rate: c.attempts ? Math.round((c.verified / c.attempts) * 100) : 0 }))
		.sort((a, b) => b.attempts - a.attempts);

	// Verified proofs on record within the window (from the verification table).
	const proofRows = verifRows.filter((r) => String(r.step).startsWith('proof_'));
	const byCategory = new Map<string, number>();
	for (const r of proofRows) byCategory.set(r.step.replace(/^proof_/, ''), (byCategory.get(r.step.replace(/^proof_/, '')) ?? 0) + 1);

	return {
		days,
		funnel,
		headline: { opened: openedCount, uploaded: uploadedCount, bailed, bailPct },
		categories,
		onRecord: {
			total: proofRows.length,
			users: new Set(proofRows.map((r) => r.user_id)).size,
			byCategory: [...byCategory.entries()].map(([cat, n]) => ({ cat, n })).sort((a, b) => b.n - a.n)
		},
		instrumented: results.length > 0
	};
}
