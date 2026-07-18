import type { PageServerLoad } from './$types';
import { getSupabase } from '$lib/server/supabase';

/**
 * Feature Usage — proof-upload funnel.
 *
 * Answers the core question: do people even open the proof-upload screen, and
 * of those who do, how many actually upload and get verified?
 *
 * Data source: the Flutter app's `mobile_event_log`. The proof screen already
 * logs the early stages (screen view on open, an action when an upload starts);
 * a `proof_result` action (added alongside this dashboard) closes the loop with
 * the verified outcome + category. Verified proofs are also cross-checked against
 * `verified_vibe_verification` (step = 'proof_<category>'), which has full history
 * even before the new event ships.
 */

const WINDOW_DAYS = 30;

type EventRow = {
	user_id: string | null;
	event_type: string;
	screen: string | null;
	action: string | null;
	metadata: Record<string, unknown> | null;
	created_at: string;
};

export const load: PageServerLoad = async () => {
	const sb = getSupabase();
	const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

	const [{ data: proofEvents }, { data: verifRows }] = await Promise.all([
		// Every mobile event fired from the proof-upload screen in the window.
		sb
			.from('mobile_event_log')
			.select('user_id, event_type, screen, action, metadata, created_at')
			.eq('screen', 'proof_upload')
			.gte('created_at', since)
			.order('created_at', { ascending: true }),
		// Verified proofs on record (all-time) — step is 'proof_<category>'.
		sb
			.from('verified_vibe_verification')
			.select('user_id, step, completed_at, created_at')
			.like('step', 'proof_%')
			.eq('status', 'completed'),
	]);

	const rows = (proofEvents ?? []) as EventRow[];

	// ── Stage buckets ──────────────────────────────────────────────────────────
	const opened = rows.filter((r) => r.event_type === 'navigation');
	const started = rows.filter(
		(r) => r.event_type === 'action' && (r.action === 'upload_proof' || r.action === 'submit_proof')
	);
	const results = rows.filter((r) => r.event_type === 'action' && r.action === 'proof_result');
	const verified = results.filter((r) => r.metadata?.verified === true);

	const funnel = [
		stage('opened', 'Opened proof screen', 'viewed the "Add a proof" page', opened, null),
		stage('started', 'Started an upload', 'tapped upload / connect', started, opened),
		stage('uploaded', 'Completed an upload', 'submitted and got a result back', results, started),
		stage('verified', 'Verified', 'proof passed AI verification', verified, results),
	];

	// Headline: of those who opened, how many never completed an upload.
	const openedCount = opened.length;
	const uploadedCount = results.length;
	const bailed = Math.max(0, openedCount - uploadedCount);
	const bailPct = openedCount ? Math.round((bailed / openedCount) * 100) : 0;

	// ── Per-category breakdown (from proof_result events) ───────────────────────
	const catMap = new Map<string, { attempts: number; verified: number }>();
	for (const r of results) {
		const cat = String(r.metadata?.category ?? 'unknown');
		const c = catMap.get(cat) ?? { attempts: 0, verified: 0 };
		c.attempts++;
		if (r.metadata?.verified === true) c.verified++;
		catMap.set(cat, c);
	}
	const categories = [...catMap.entries()]
		.map(([cat, c]) => ({
			cat,
			attempts: c.attempts,
			verified: c.verified,
			rate: c.attempts ? Math.round((c.verified / c.attempts) * 100) : 0,
		}))
		.sort((a, b) => b.attempts - a.attempts);

	// ── Verified proofs on record (all-time, from the verification table) ───────
	const verif = (verifRows ?? []) as { user_id: string; step: string; completed_at: string | null; created_at: string }[];
	const verifiedOnRecordUsers = new Set(verif.map((v) => v.user_id)).size;
	const verifiedByCategory = new Map<string, number>();
	for (const v of verif) {
		const cat = v.step.replace(/^proof_/, '');
		verifiedByCategory.set(cat, (verifiedByCategory.get(cat) ?? 0) + 1);
	}

	// ── 30-day daily trend: opened vs verified ──────────────────────────────────
	const trend = buildTrend(opened, verified, WINDOW_DAYS);

	// Whether the new outcome event has started landing yet (ships with the mobile
	// release). Until then, results/verified are 0 but opened/started still show.
	const instrumented = results.length > 0;

	const lastEventAt = rows.length ? rows[rows.length - 1].created_at : null;

	return {
		windowDays: WINDOW_DAYS,
		funnel,
		headline: { opened: openedCount, uploaded: uploadedCount, bailed, bailPct },
		categories,
		verifiedOnRecord: {
			total: verif.length,
			users: verifiedOnRecordUsers,
			byCategory: [...verifiedByCategory.entries()]
				.map(([cat, n]) => ({ cat, n }))
				.sort((a, b) => b.n - a.n),
		},
		trend,
		instrumented,
		lastEventAt,
		totalEvents: rows.length,
	};
};

function stage(
	key: string,
	label: string,
	sub: string,
	rowsForStage: EventRow[],
	prev: EventRow[] | null
) {
	const count = rowsForStage.length;
	const users = new Set(rowsForStage.map((r) => r.user_id).filter(Boolean)).size;
	const conv = prev && prev.length ? Math.round((count / prev.length) * 100) : null;
	return { key, label, sub, count, users, conv };
}

function buildTrend(opened: EventRow[], verified: EventRow[], days: number) {
	const labels: string[] = [];
	const openedByDay: number[] = [];
	const verifiedByDay: number[] = [];
	const now = new Date();
	for (let i = days - 1; i >= 0; i--) {
		const d = new Date(now);
		d.setDate(d.getDate() - i);
		const label = d.toISOString().slice(0, 10);
		labels.push(label);
		openedByDay.push(opened.filter((r) => r.created_at.slice(0, 10) === label).length);
		verifiedByDay.push(verified.filter((r) => r.created_at.slice(0, 10) === label).length);
	}
	return { labels, opened: openedByDay, verified: verifiedByDay };
}
