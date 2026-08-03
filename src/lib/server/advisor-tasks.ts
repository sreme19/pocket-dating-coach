/**
 * Async advisor tasks — "ask, leave, come back to a finished answer".
 *
 * Some coaching questions need real work behind them: scanning the pool, auditing
 * a profile against what the other side actually weights. That takes longer than a
 * chat reply should sit spinning, and the user should be free to close the app.
 *
 * The flow:
 *   1. the chat endpoint spots a task-shaped ask and calls `createAdvisorTask`
 *   2. an acknowledgement turn lands in the thread immediately ("on it, you can
 *      close this")
 *   3. /api/cron/advisor-tasks claims the row and AWAITS the work
 *   4. the result is written as a real thread turn, the unread badge lifts, and one
 *      push goes out
 *
 * Why not reuse vv_intelligence_reports: it has the right status lifecycle but has
 * never run once in production, its result is delivered by piggybacking on the
 * user's NEXT message (so opening the tab and just looking shows nothing), and
 * nothing sweeps its stranded rows. This replaces that delivery model; the actual
 * report generators are reused unchanged.
 */

import { getSupabase } from '$lib/server/supabase';
import { appendAdvisorMessage, type AssistantType } from '$lib/server/advisor-thread';
import { sendToUser } from '$lib/server/notifications';
import {
	generatePerMatchRanking,
	generateFemaleCompetitiveReport
} from '$lib/server/matchmaker-service';

type SB = ReturnType<typeof getSupabase>;

/**
 * Task kinds. `photo_audit` and `competitive_scan` exist in the table's CHECK
 * constraint but are not dispatched yet — the intent detector never produces them,
 * so nothing can queue work the runner would not know how to do.
 */
export type AdvisorTaskKind = 'match_scan' | 'profile_audit' | 'photo_audit' | 'competitive_scan';

export type AdvisorTaskStatus = 'queued' | 'running' | 'ready' | 'failed' | 'cancelled';

export interface AdvisorTask {
	id: string;
	userId: string;
	assistantType: AssistantType;
	kind: AdvisorTaskKind;
	requestText: string;
	status: AdvisorTaskStatus;
	attempts: number;
}

/** Give up after this many tries so a deterministically-failing task can't loop. */
const MAX_ATTEMPTS = 3;

/** How many tasks one sweep will run. Bounded by the cron's maxDuration. */
const SWEEP_BATCH = 5;

/**
 * A `running` row older than this is assumed dead — the function that claimed it
 * was frozen or timed out mid-flight — and becomes eligible again.
 */
const STALE_RUNNING_MINUTES = 15;

// ── Intent detection ─────────────────────────────────────────────────────────

/**
 * Does this message deserve real work rather than a chat reply?
 *
 * Deliberately conservative: a false positive turns a question the assistant could
 * have answered instantly into a two-minute wait, which is a worse experience than
 * the status quo. Only asks that clearly want a fresh analysis qualify.
 */
export function detectTaskIntent(message: string): AdvisorTaskKind | null {
	const m = message.toLowerCase().trim();
	if (m.length < 6) return null;

	// "why am I not getting matches", "help me get matches", "find me matches"
	const wantsMatchWork =
		/\b(help me|how do i|why (am i|aren'?t i)|what'?s stopping me)\b/.test(m) &&
		/\b(match|matches|matched|dates?)\b/.test(m);

	// "audit my profile", "what should I upload", "review my profile"
	const wantsProfileWork =
		/\b(audit|review|go through|check over)\b.*\b(profile|photos?|proofs?)\b/.test(m) ||
		/\bwhat should i (upload|add|verify|fix)\b/.test(m);

	if (wantsProfileWork) return 'profile_audit';
	if (wantsMatchWork) return 'match_scan';
	return null;
}

/** What the assistant says while the work runs, plus the steps shown on the card. */
export function ackCopy(
	kind: AdvisorTaskKind,
	assistantType: AssistantType
): { content: string; steps: string[]; etaMinutes: number } {
	const audience = assistantType === 'bestie' ? 'your matches' : 'the pool';
	if (kind === 'profile_audit') {
		return {
			content:
				"On it — I'm going through your profile the way the other side reads it, and I'll come back with what to fix first. **You can close this**, I'll ping you when it's ready.",
			steps: ['Read your profile and proofs', 'Weigh them against what your matches value', 'Rank what to fix first'],
			etaMinutes: 2
		};
	}
	return {
		content: `On it — I'm scanning ${audience} against your profile properly. **You can close this**, I'll ping you the moment it's ready.`,
		steps: [`Read your profile and proofs`, `Rank everyone against your criteria`, `Write your shortlist`],
		etaMinutes: 2
	};
}

// ── Create ───────────────────────────────────────────────────────────────────

/**
 * Queue a task and post its acknowledgement turn.
 *
 * Returns `null` when an identical task is already in flight — the unique partial
 * index on (user_id, kind) WHERE status IN ('queued','running') is what enforces
 * that, so five taps join one run instead of spawning five. The caller should then
 * answer normally rather than acknowledging twice.
 */
export async function createAdvisorTask(
	sb: SB,
	opts: {
		userId: string;
		assistantType: AssistantType;
		kind: AdvisorTaskKind;
		requestText: string;
		/**
		 * The user's own turn, appended before the acknowledgement so the thread
		 * reads in the order it happened. Written only once the task row exists —
		 * otherwise a rejected duplicate would leave an orphaned question behind
		 * that the normal reply path then writes a second time.
		 */
		userMessage?: string;
	}
): Promise<{ taskId: string; ackContent: string } | null> {
	const { data, error } = await (sb as SBAny)
		.from('advisor_tasks')
		.insert({
			user_id: opts.userId,
			assistant_type: opts.assistantType,
			kind: opts.kind,
			request_text: opts.requestText.slice(0, 1000),
			status: 'queued'
		})
		.select('id')
		.single();

	if (error || !data) {
		// 23505 = unique violation = one is already in flight. Anything else is a
		// real failure, and either way we fall back to a normal reply.
		if (error?.code !== '23505') {
			console.error('[advisor-tasks] create failed:', error);
		}
		return null;
	}

	const taskId = (data as { id: string }).id;
	const ack = ackCopy(opts.kind, opts.assistantType);

	if (opts.userMessage) {
		await appendAdvisorMessage(sb, {
			userId: opts.userId,
			assistantType: opts.assistantType,
			role: 'user',
			content: opts.userMessage
		});
	}

	const ackTurn = await appendAdvisorMessage(sb, {
		userId: opts.userId,
		assistantType: opts.assistantType,
		role: 'assistant',
		kind: 'task_ack',
		content: ack.content,
		payload: { steps: ack.steps, etaMinutes: ack.etaMinutes, taskKind: opts.kind },
		taskId
	});

	if (ackTurn) {
		await (sb as SBAny)
			.from('advisor_tasks')
			.update({ ack_message_id: ackTurn.id, progress_note: ack.steps[0] })
			.eq('id', taskId);
	}

	return { taskId, ackContent: ack.content };
}

// ── Claim ────────────────────────────────────────────────────────────────────

/**
 * Atomically take ownership of the next runnable task.
 *
 * The status guard in the WHERE clause is the lock: two overlapping cron
 * invocations both try the same row, and only the one whose UPDATE still matches
 * `status='queued'` gets it back.
 */
async function claimTask(sb: SB, id: string): Promise<AdvisorTask | null> {
	const { data } = await (sb as SBAny)
		.from('advisor_tasks')
		.update({ status: 'running', started_at: new Date().toISOString() })
		.eq('id', id)
		.eq('status', 'queued')
		.select('id, user_id, assistant_type, kind, request_text, status, attempts')
		.maybeSingle();

	const row = data as Record<string, unknown> | null;
	if (!row) return null;
	return {
		id: String(row.id),
		userId: String(row.user_id),
		assistantType: row.assistant_type as AssistantType,
		kind: row.kind as AdvisorTaskKind,
		requestText: String(row.request_text ?? ''),
		status: row.status as AdvisorTaskStatus,
		attempts: Number(row.attempts ?? 0)
	};
}

/**
 * Release tasks whose runner died mid-flight back to 'queued'.
 *
 * Without this a serverless timeout leaves a row stuck on 'running' forever, and
 * the in-flight uniqueness index then blocks the user from ever asking again. The
 * equivalent gap in vv_intelligence_reports is why a failed report there is
 * stranded until the user re-requests it by hand.
 */
async function requeueStale(sb: SB): Promise<number> {
	const cutoff = new Date(Date.now() - STALE_RUNNING_MINUTES * 60_000).toISOString();
	const { data } = await (sb as SBAny)
		.from('advisor_tasks')
		.update({ status: 'queued', progress_note: 'Restarting — the last attempt did not finish.' })
		.eq('status', 'running')
		.lt('started_at', cutoff)
		.lt('attempts', MAX_ATTEMPTS)
		.select('id');
	return ((data ?? []) as unknown[]).length;
}

// ── Run ──────────────────────────────────────────────────────────────────────

interface TaskResult {
	summary: string;
	body: string;
	payload: Record<string, unknown>;
}

/**
 * Do the work. Reuses the existing report generators rather than a second
 * implementation, so the numbers here and the ones the matchmaker computes can
 * never drift.
 *
 * NOTE: this deliberately does NOT create matches. "Help me get matches" produces
 * an analysis of what is blocking them; actually firing the matchmaker spends the
 * user's run quota, and a chat message is the wrong place to silently do that —
 * the Find Matches button owns that decision.
 */
async function runTask(task: AdvisorTask): Promise<TaskResult> {
	if (task.assistantType === 'bestie') {
		const report = await generateFemaleCompetitiveReport(task.userId);
		const actions = report.actionList.sort((a, b) => a.priority - b.priority);
		return {
			summary: report.summary || 'Here is where you stand right now.',
			body: [
				report.summary,
				report.positioning ? `\n${report.positioning}` : '',
				actions.length
					? `\n\n**What moves the needle, in order:**\n` +
						actions.map((a) => `${a.priority}. **${a.action}** — ${a.impact}`).join('\n')
					: ''
			]
				.filter(Boolean)
				.join('')
				.trim(),
			payload: {
				kind: task.kind,
				actions,
				topMenInPool: report.topMenInPool
			}
		};
	}

	const report = await generatePerMatchRanking(task.userId);
	const actions = report.actionList.sort((a, b) => a.priority - b.priority);
	return {
		summary: report.summary || 'Here is where you stand right now.',
		body: [
			report.summary,
			report.matches.length
				? `\n\n**Where you rank:**\n` +
					report.matches.map((m) => `- With ${m.firstName}: ${m.rank}`).join('\n')
				: '',
			actions.length
				? `\n\n**What moves the needle, in order:**\n` +
					actions.map((a) => `${a.priority}. **${a.action}** — ${a.impact}`).join('\n')
				: ''
		]
			.filter(Boolean)
			.join('')
			.trim(),
		payload: { kind: task.kind, actions, matches: report.matches }
	};
}

// ── Complete / fail ──────────────────────────────────────────────────────────

async function completeTask(sb: SB, task: AdvisorTask, result: TaskResult): Promise<void> {
	const resultTurn = await appendAdvisorMessage(sb, {
		userId: task.userId,
		assistantType: task.assistantType,
		role: 'assistant',
		kind: 'task_result',
		content: result.body,
		payload: result.payload,
		taskId: task.id
	});

	// completed_at is set ONLY here, on success — the same convention as
	// vv_matchmaker_runs, where a NULL on a finished-looking row is what exposed
	// the silently-dead nightly matcher.
	await (sb as SBAny)
		.from('advisor_tasks')
		.update({
			status: 'ready',
			result_summary: result.summary.slice(0, 2000),
			payload: result.payload,
			result_message_id: resultTurn?.id ?? null,
			progress_note: null,
			completed_at: new Date().toISOString(),
			error: null
		})
		.eq('id', task.id);

	// The result is deliberately NOT marked read: an unseen answer is exactly what
	// the badge is for. `advisor_task_ready` is exempt from the daily cap and quiet
	// hours — the user pressed a button and left, on our promise to tell them.
	await sendToUser(task.userId, {
		title: task.kind === 'profile_audit' ? 'Your profile audit is ready' : 'Your match scan is ready',
		body: result.summary,
		type: 'advisor_task_ready',
		deepLink:
			task.assistantType === 'bestie'
				? '/verified-vibe/chat/ai-bestie'
				: '/verified-vibe/chat/ai-wingman'
	}).catch((e) => console.warn('[advisor-tasks] push failed (non-fatal):', e));
}

async function failTask(sb: SB, task: AdvisorTask, err: unknown): Promise<void> {
	const attempts = task.attempts + 1;
	const message = err instanceof Error ? err.message : String(err);
	const giveUp = attempts >= MAX_ATTEMPTS;

	await (sb as SBAny)
		.from('advisor_tasks')
		.update({
			// Back to 'queued' so the next sweep retries; 'failed' only once we stop.
			status: giveUp ? 'failed' : 'queued',
			attempts,
			error: message.slice(0, 1000),
			progress_note: giveUp ? null : 'Retrying shortly.',
			completed_at: null
		})
		.eq('id', task.id);

	if (!giveUp) return;

	// Tell them rather than leaving a card spinning forever.
	await appendAdvisorMessage(sb, {
		userId: task.userId,
		assistantType: task.assistantType,
		role: 'assistant',
		kind: 'task_result',
		content:
			"I couldn't finish that one — something went wrong on my side, not yours. Ask me again and I'll retry it.",
		payload: { kind: task.kind, failed: true },
		taskId: task.id
	});
}

// ── Sweep (the cron's entry point) ───────────────────────────────────────────

export interface SweepReport {
	requeuedStale: number;
	claimed: number;
	ready: number;
	failed: number;
	skipped: number;
}

/**
 * Run up to SWEEP_BATCH pending tasks to completion.
 *
 * Every task is AWAITED. Fire-and-forget is what killed the nightly matchmaker for
 * seven weeks: the function answered, Vercel froze the invocation, and the work
 * never happened — six run rows with completed_at NULL and zero pairs evaluated.
 */
export async function sweepAdvisorTasks(): Promise<SweepReport> {
	const sb = getSupabase();
	const report: SweepReport = { requeuedStale: 0, claimed: 0, ready: 0, failed: 0, skipped: 0 };

	report.requeuedStale = await requeueStale(sb);

	const { data: pending } = await (sb as SBAny)
		.from('advisor_tasks')
		.select('id')
		.eq('status', 'queued')
		.lt('attempts', MAX_ATTEMPTS)
		.order('requested_at', { ascending: true })
		.limit(SWEEP_BATCH);

	for (const row of ((pending ?? []) as Array<{ id: string }>)) {
		const task = await claimTask(sb, row.id);
		if (!task) {
			// Another invocation got there first.
			report.skipped++;
			continue;
		}
		report.claimed++;

		try {
			const result = await runTask(task);
			await completeTask(sb, task, result);
			report.ready++;
		} catch (e) {
			console.error(`[advisor-tasks] ${task.kind} failed for ${task.userId}:`, e);
			await failTask(sb, task, e);
			report.failed++;
		}
	}

	return report;
}

/** Generated DB types lag advisor_tasks; narrowed to this module. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SBAny = any;
