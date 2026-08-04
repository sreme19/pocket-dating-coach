import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import { resolveProxyPair } from '$lib/server/bestie-pair';
import {
	canAskMore,
	reopenWithQuestions,
	screenFreeText,
	roundsRemaining,
	isFinalRound,
	FREE_TEXT_MAX,
	MAX_ROUNDS
} from '$lib/server/question-rounds';

/**
 * POST /api/verified-vibe/ai-bestie/ask-more
 *   { conversationId, topics: [{id,label,topic?}], freeText?, applyGlobally? }
 *
 * "Ask him more" (G-27). At the hand-off she gets three ways to COMMIT — step in,
 * set up a call, share her details — and nothing for "interested, but not ready".
 * That state became silence, and silence expires the match: two thirds of Bestie's
 * completed hand-offs died exactly that way. This is the missing button.
 *
 * What it does: appends her questions to the checklist, reopens it (which is also how
 * the 48h clock is suspended — the clock is derived from wrapped_at, so there is no
 * separate pause state to disagree with it), spends one of her two rounds, and lets
 * Bestie's normal reply path carry them to him.
 *
 * Only the WOMAN may call this, and only while Bestie is still her proxy.
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json().catch(() => ({}))) as {
			conversationId?: string;
			topics?: Array<{ id?: string; label?: string; topic?: string | null }>;
			freeText?: string;
			applyGlobally?: boolean;
		};
		const conversationId = body.conversationId;
		if (!conversationId) return json({ error: 'Missing conversationId' }, { status: 400 });

		const authHeader = request.headers.get('authorization') ?? '';
		const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
		if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

		const { createClient } = await import('@supabase/supabase-js');
		const { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } = await import('$env/static/public');
		const userClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
			global: { headers: { Authorization: `Bearer ${token}` } }
		});
		const { data: { user }, error: userError } = await userClient.auth.getUser();
		if (userError || !user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

		const supabase = getSupabase() as any;

		const { data: match } = await supabase
			.from('verified_vibe_matches')
			.select('id, user1_id, user2_id, status, ai_bestie_active, bestie_checklist, bestie_question_rounds')
			.eq('id', conversationId)
			.single();
		if (!match) return json({ error: 'Conversation not found' }, { status: 404 });
		if (match.user1_id !== user.id && match.user2_id !== user.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Only the owner, and only on a real proxy pair — a same-gender networking
		// connection has no Bestie to send back in.
		const pair = await resolveProxyPair(supabase, conversationId);
		if (!pair || pair.woman.id !== user.id) {
			return json({ error: 'Only she can ask him more' }, { status: 403 });
		}

		const roundsUsed = Number(match.bestie_question_rounds ?? 0);
		const gate = canAskMore({
			bestieActive: match.ai_bestie_active !== false,
			checklistStatus: (match.bestie_checklist as any)?.status,
			roundsUsed,
			status: match.status
		});
		if (!gate.allowed) return json({ error: gate.reason }, { status: 409 });

		// Screen her free text BEFORE anything is written. She can type anything, and
		// this is a direct path from her keyboard into what Bestie says to a real
		// person. A declined question is explained and paired with an alternative —
		// never silently dropped, which would leave her believing it was asked.
		const rawFree = (body.freeText ?? '').toString().trim().slice(0, FREE_TEXT_MAX);
		const verdict = screenFreeText(rawFree);
		if (!verdict.allowed) {
			return json(
				{ error: verdict.refusal, alternative: verdict.alternative, code: 'question_not_allowed' },
				{ status: 422 }
			);
		}

		// Her picked topics, plus her own words as one more item. No cap: these are
		// items SHE chose, and dropping the seventh silently would be worse than a long
		// list. Bestie still paces delivery and still may not drill one subject.
		const questions = (body.topics ?? [])
			.map((t) => ({
				id: (t.id ?? t.label ?? '').toString(),
				label: (t.label ?? '').toString(),
				topic: t.topic ?? null
			}))
			.filter((t) => t.label.trim().length > 0);
		if (rawFree) {
			questions.push({ id: `her-question-${roundsUsed + 1}`, label: rawFree, topic: null });
		}
		if (questions.length === 0) {
			return json({ error: 'Pick something you want to know first.' }, { status: 400 });
		}

		const reopened = reopenWithQuestions(match.bestie_checklist as any, questions);
		if (!reopened) {
			return json({ error: "I've already asked him all of that." }, { status: 409 });
		}

		// Guarded on rev so two taps cannot both spend a round, and on the round count
		// so a retry cannot push her past the limit.
		const { data: updated } = await supabase
			.from('verified_vibe_matches')
			.update({
				bestie_checklist: reopened,
				bestie_question_rounds: roundsUsed + 1,
				// A reopened checklist is not a pending hand-off any more, so the nudge
				// ladder restarts when Bestie wraps again.
				handoff_nudge_stage: 0
			})
			.eq('id', conversationId)
			.eq('bestie_question_rounds', roundsUsed)
			.select('id');
		if (!updated || updated.length === 0) {
			return json({ error: 'That went through already — give me a moment.' }, { status: 409 });
		}

		// Her picked topics fold into what she always wants checked, for OTHER men.
		// Topics only: her free text is about this man and stays with him. Her `w`
		// weights are deliberately untouched — those decide who she is matched with and
		// how every man ranks, and changing them silently from a question she asked one
		// person would reshape her whole pool.
		if (body.applyGlobally) {
			await applyGlobalTopics(supabase, user.id, body.topics ?? []).catch(() => {});
		}

		// Bestie goes back to him. Fire-and-forget: her tap must not wait on generation.
		const finalRound = isFinalRound(roundsUsed);
		void (async () => {
			try {
				const { generateAndSendBestieReply } = await import('$lib/server/bestie-responder');
				const { data: last } = await supabase
					.from('verified_vibe_messages')
					.select('id, content, created_at')
					.eq('match_id', conversationId)
					.eq('sender_id', pair.man.id)
					.order('created_at', { ascending: false, nullsFirst: false })
					.limit(1)
					.maybeSingle();
				await generateAndSendBestieReply(
					pair.woman.id,
					conversationId,
					last?.id ?? '',
					last?.content ?? '',
					last?.created_at ?? undefined
				);
			} catch (e) {
				console.error('[ask-more] re-engage failed (non-fatal):', e);
			}
		})();

		return json({
			success: true,
			roundsUsed: roundsUsed + 1,
			roundsRemaining: roundsRemaining(roundsUsed + 1),
			finalRound,
			maxRounds: MAX_ROUNDS
		});
	} catch (error) {
		console.error('ask-more error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

/**
 * Fold her picked topics into what she always wants asked.
 *
 * Appends to her stated preferences rather than touching her weights. Non-fatal: a
 * failure here must not undo a round she has already spent.
 */
async function applyGlobalTopics(
	supabase: any,
	userId: string,
	topics: Array<{ label?: string; topic?: string | null }>
): Promise<void> {
	const labels = topics.map((t) => (t.label ?? '').trim()).filter(Boolean);
	if (labels.length === 0) return;

	const { data: row } = await supabase
		.from('verified_vibe_users')
		.select('always_ask_topics')
		.eq('id', userId)
		.maybeSingle();
	const existing: string[] = Array.isArray(row?.always_ask_topics) ? row.always_ask_topics : [];
	const merged = Array.from(new Set([...existing, ...labels])).slice(0, 20);
	await supabase.from('verified_vibe_users').update({ always_ask_topics: merged }).eq('id', userId);
}
