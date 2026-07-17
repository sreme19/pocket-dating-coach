import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';
import { getTrustScoreBand } from '$lib/server/pool-registry';
import { runMatchmakerForUser } from '$lib/server/matchmaker-service';
import { sendPushNotification } from '$lib/verified-vibe/server/notifications';

/**
 * Hand-off timeout, nudge cadence, expiry, replacement & purge sweep (spec B2, revised).
 *
 * When AI Bestie wraps up her checklist she hands off to the woman: the clock starts
 * at the wrap-up. Runs hourly. Each awaiting-her match (status='mutual',
 * ai_bestie_active=true, checklist 'wrapped') moves through:
 *
 *   nudge stage 1 (@ hand-off)  → advisor nudge: "he cleared the bar, your move"
 *   nudge stage 2 (@ 24h)       → advisor nudge: reminder
 *   nudge stage 3 (@ 45h)       → advisor nudge + ONE push: final-hours warning
 *   expiry        (@ 48h)       → status='expired' (REVERSIBLE), Bestie off, and:
 *       · his side  → he's given a fresh replacement match (system-initiated,
 *                     no quota charge); the expired row links to it.
 *       · her side  → the card drops into her Inactive section with a Reactivate
 *                     button (see the reactivate endpoint).
 *
 * Applies to ALL sources (matchmaker + notice_me) — the revised spec no longer
 * exempts notice_me. "She stepped in" = she sent her own reply, which flips
 * ai_bestie_active=false; such a match is excluded here automatically.
 *
 * Finally, 'expired' rows older than 30 days that were never reactivated are
 * hard-deleted (messages cascade).
 *
 * Auth: Authorization: Bearer <CRON_SECRET>. See vercel.json for the schedule.
 */

const HANDOFF_TIMEOUT_HOURS = 48;
const NUDGE_24H_HOURS = 24;
const NUDGE_FINAL_HOURS = 45; // ~3h before expiry
const EXPIRED_PURGE_DAYS = 30;

function authorized(request: Request): boolean {
	const secret = process.env.CRON_SECRET;
	if (!secret) return false;
	const header = request.headers.get('authorization') ?? '';
	return header.startsWith('Bearer ') && header.slice(7) === secret;
}

type MatchRow = {
	id: string;
	user1_id: string;
	user2_id: string;
	bestie_checklist: { wrapped_at?: string } | null;
	handoff_nudge_stage: number | null;
};

type UserRow = { id: string; gender: string; first_name: string | null; archetype: string | null; trust_score: number | null };

function wrappedAt(m: MatchRow): number | null {
	const raw = m.bestie_checklist?.wrapped_at;
	if (!raw) return null;
	const t = Date.parse(raw);
	return Number.isNaN(t) ? null : t;
}

/** Which nudge stage this elapsed time (hours) is due for, before expiry. */
function targetStage(hours: number): 1 | 2 | 3 {
	if (hours >= NUDGE_FINAL_HOURS) return 3;
	if (hours >= NUDGE_24H_HOURS) return 2;
	return 1;
}

function nudgeCopy(stage: 1 | 2 | 3, manName: string): { advisor: string; push?: { title: string; body: string } } {
	if (stage === 1) {
		return {
			advisor: `${manName} just cleared the bar — he's shown up on the things you said matter to you. Your move: reply, start a call, or share your details. You've got 48 hours before he moves on to someone new.`
		};
	}
	if (stage === 2) {
		return {
			advisor: `Quick nudge — ${manName} is still waiting on you. About a day left before he rolls to a new match. Want me to help you open the conversation?`
		};
	}
	return {
		advisor: `Last chance with ${manName} — only a few hours left before this match expires and he's given someone new. Step in now if you're interested.`,
		push: { title: `Don't lose ${manName}`, body: 'Only a few hours left to step in before he moves on.' }
	};
}

async function sweep() {
	const supabase = getSupabase() as any;
	const now = Date.now();
	const nowIso = new Date(now).toISOString();

	// Awaiting-her matches: Bestie wrapped up but the woman never stepped in.
	const { data: awaiting, error } = await supabase
		.from('verified_vibe_matches')
		.select('id, user1_id, user2_id, bestie_checklist, handoff_nudge_stage')
		.eq('status', 'mutual')
		.eq('ai_bestie_active', true)
		.eq('bestie_checklist->>status', 'wrapped');

	if (error) throw error;

	const rows = (awaiting ?? []) as MatchRow[];

	// Resolve everyone's gender/name once (nudges + expiry need man vs woman).
	const userIds = Array.from(new Set(rows.flatMap((m) => [m.user1_id, m.user2_id])));
	const byId = new Map<string, UserRow>();
	if (userIds.length) {
		const { data: users } = await supabase
			.from('verified_vibe_users')
			.select('id, gender, first_name, archetype, trust_score')
			.in('id', userIds);
		for (const u of (users ?? []) as UserRow[]) byId.set(u.id, u);
	}

	const sides = (m: MatchRow): { man: UserRow; woman: UserRow } | null => {
		const a = byId.get(m.user1_id);
		const b = byId.get(m.user2_id);
		if (!a || !b) return null;
		const man = a.gender === 'man' ? a : b.gender === 'man' ? b : null;
		const woman = a.gender === 'woman' ? a : b.gender === 'woman' ? b : null;
		if (!man || !woman) return null; // same-gender pairs aren't handled in v1
		return { man, woman };
	};

	const toExpire: MatchRow[] = [];
	let nudged = 0;

	for (const m of rows) {
		const w = wrappedAt(m);
		if (w == null) continue; // no clock → skip
		const hours = (now - w) / 3_600_000;

		if (hours >= HANDOFF_TIMEOUT_HOURS) {
			toExpire.push(m);
			continue;
		}

		// Nudge cadence — fire the due stage at most once.
		const stage = targetStage(hours);
		const sent = m.handoff_nudge_stage ?? 0;
		if (stage > sent) {
			const s = sides(m);
			if (s) {
				const copy = nudgeCopy(stage, s.man.first_name ?? 'He');
				await supabase.from('ai_assistant_greetings').insert({
					user_id: s.woman.id,
					assistant_type: 'bestie',
					mode: 2,
					content: copy.advisor,
					topic_tags: ['handoff_nudge', `stage_${stage}`, m.id]
				});
				if (copy.push) {
					await sendPushNotification(s.woman.id, {
						title: copy.push.title,
						body: copy.push.body,
						data: { type: 'handoff_nudge', matchId: m.id }
					}).catch(() => {});
				}
				await supabase
					.from('verified_vibe_matches')
					.update({ handoff_nudge_stage: stage })
					.eq('id', m.id);
				nudged++;
			}
		}
	}

	// Expire + replace.
	let expired = 0;
	const outcomeRows: any[] = [];
	for (const m of toExpire) {
		await supabase
			.from('verified_vibe_matches')
			.update({ status: 'expired', ai_bestie_active: false, expired_at: nowIso })
			.eq('id', m.id);

		const s = sides(m);
		if (!s) continue;

		// His fresh replacement (system-initiated: no quota charge, not limit-gated).
		try {
			const r = await runMatchmakerForUser(s.man.id, { system: true });
			if (r.status === 'matched' && r.match?.matchId) {
				await supabase
					.from('verified_vibe_matches')
					.update({ replaced_by_match_id: r.match.matchId })
					.eq('id', m.id);
			}
		} catch (e) {
			console.error('[handoff-timeout] replacement match failed (non-fatal):', e);
		}

		// Analytics: system-initiated stall at hand-off. Keeps the 'unmatched'
		// outcome label the feedback loop already understands.
		outcomeRows.push({
			match_id: m.id,
			male_user_id: s.man.id,
			female_user_id: s.woman.id,
			outcome: 'unmatched',
			initiated_by_gender: 'system',
			male_archetype: s.man.archetype,
			female_archetype: s.woman.archetype,
			male_trust_band: getTrustScoreBand(s.man.trust_score ?? 0),
			outcome_at: nowIso
		});
		expired++;
	}
	if (outcomeRows.length) {
		try {
			await supabase.from('vv_match_outcome_signals').insert(outcomeRows);
		} catch (e) {
			console.error('[handoff-timeout] outcome recording failed (non-fatal):', e);
		}
	}

	// Purge: expired > 30 days, never reactivated. Hard-delete (messages cascade).
	let purged = 0;
	const purgeCutoff = new Date(now - EXPIRED_PURGE_DAYS * 86_400_000).toISOString();
	const { data: stale } = await supabase
		.from('verified_vibe_matches')
		.select('id')
		.eq('status', 'expired')
		.lt('expired_at', purgeCutoff);
	if (stale?.length) {
		const ids = stale.map((r: any) => r.id);
		await supabase.from('verified_vibe_matches').delete().in('id', ids);
		purged = ids.length;
	}

	return { nudged, expired, purged };
}

const handle: RequestHandler = async ({ request }) => {
	if (!authorized(request)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	try {
		const result = await sweep();
		return json({ success: true, ...result });
	} catch (err) {
		console.error('[cron/handoff-timeout] failed:', err);
		return json(
			{ error: 'sweep failed', details: err instanceof Error ? err.message : String(err) },
			{ status: 500 }
		);
	}
};

export const GET = handle;
export const POST = handle;
