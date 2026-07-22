/**
 * Server-side AI Bestie responder.
 *
 * Generates (and optionally sends) a Bestie reply on behalf of a female user in
 * a dating conversation. This runs server-side so it works even when the user's
 * app is closed — triggered when a match sends her a message.
 */
import { getClaudeClient, CLAUDE_MODEL } from '$lib/claude';
import { getSupabase } from '$lib/server/supabase';
import { loadPreferences } from '$lib/server/profile-service';
import type { PreferencesProfile } from '$lib/server/profile-service';
import { buildBestieReplyPrompt, stripBannedDashes, buildBestieChecklistPrompt } from '$lib/prompts';
import {
	PROOF_CATEGORY_PRIORITY,
	PROOF_CATEGORY_LABELS,
	loadProofSignals,
	isProofRequestActive,
	refusedCategories,
	askedCategories,
	type ProofRequestCategory,
	type ProofRequestState,
} from '$lib/server/proof-signals';
import {
	buildChecklistBlock,
	buildChecklist,
	nextChecklistState,
	mergeChecklist,
	buildHandoffPhaseBlock,
	handoffClosingLine,
	isWrapped,
	CHECKLIST_MAX_ITEMS,
	type BestieChecklist,
} from '$lib/server/bestie-checklist';
import { buildNotificationPayload, sendNotification } from '$lib/server/notifications';
import { assessHandoffReadiness, handoffProofAskLine } from '$lib/server/handoff-gate';
import { appeal, type Vec } from '$lib/server/vector-scoring';
import { buildProofInviteContext } from '$lib/server/proof-invite-context';

export interface BestieReply {
	signal: string;
	read: string;
	reply: string;
	/**
	 * When set, the Bestie's turn changed the in-chat proof-request state
	 * (invited / registered a refusal / closed a fulfilled one). Callers that
	 * SEND the reply must persist this to verified_vibe_matches.proof_request.
	 */
	proofStateUpdate?: ProofRequestState;
	/**
	 * When set, the Bestie's turn changed the CHECKLIST — either it was just created
	 * (opener turn), items were marked done, or she wrapped up. Callers that SEND the
	 * reply must persist this to verified_vibe_matches.bestie_checklist, and on a
	 * transition to `wrapped` must run the hand-off (freeze the man + notify her).
	 */
	checklistUpdate?: BestieChecklist;
	/**
	 * The female owner's first name — so the SENDER can append the hand-off closing
	 * line only when the checklist ACTUALLY transitions to wrapped in the DB (decided
	 * concurrency-safely at persist time), not from this turn's stale snapshot.
	 */
	userName?: string;
}

// ── In-chat proof request context + state machine (spec §3 Step 3) ────────────

/**
 * Build the PROOF REQUESTS prompt block from the match's current state.
 * Returns '' when there is nothing to say (no state, nothing invitable) so the
 * prompt keeps its legacy 3-field output shape.
 */
function buildProofRequestBlock(opts: {
	state: ProofRequestState | null;
	matchName: string;
	verifiedCategories: string[];
	isOpener: boolean;
}): { block: string; invitable: ProofRequestCategory[] } {
	const { state, matchName, verifiedCategories, isOpener } = opts;
	const lines: string[] = [];

	const refused = refusedCategories(state);
	const asked = askedCategories(state);

	// Invites are OFF while a request is open/fulfilled, and on the very first
	// message (the opener stays a warm hello, never an ask for evidence).
	// Otherwise: every category he hasn't verified or already been asked is
	// invitable, in highest-leverage-first order (career/fitness/travel lead;
	// the ID-gated wealth/spending/assets trail).
	let invitable: ProofRequestCategory[] = [];
	const requestOpen = isProofRequestActive(state) || state?.status === 'fulfilled';
	if (!requestOpen && !isOpener) {
		invitable = PROOF_CATEGORY_PRIORITY.filter(
			(c) => !verifiedCategories.includes(c) && !asked.includes(c)
		);
	}

	if (state?.status === 'pending') {
		lines.push(
			`- OPEN REQUEST: you already invited ${matchName} to verify "${state.category}". Do NOT re-ask or remind. If his latest message declines it, that is a refusal.`
		);
	} else if (state?.status === 'failed_attempt') {
		lines.push(
			`- FAILED ATTEMPT on "${state.category}" (${state.attempts} so far): his upload did not pass verification. Not a refusal — you may encourage ONE warm retry if it fits, then let it go.`
		);
	} else if (state?.status === 'fulfilled') {
		lines.push(
			`- FULFILLED: ${matchName}'s "${state.category}" proof JUST VERIFIED. Acknowledge it warmly and specifically in this reply.`
		);
	}
	if (refused.length > 0) {
		lines.push(
			`- DECLINED BEFORE: ${refused.join(', ')} — he chose not to share these. NEVER ask again, never hint at it, and it does not count against him in any way.`
		);
	}
	if (invitable.length > 0) {
		// Show the top few (highest-leverage first) so the prompt stays tight; the
		// state machine still honours any category in the full invitable set.
		const shortlist = invitable.slice(0, 4);
		lines.push(
			`- AVAILABLE to invite (pick the ONE that matches what he's talking about — see the topic→proof map in the rules): ${shortlist
				.map((c) => `${c} = ${PROOF_CATEGORY_LABELS[c]}`)
				.join('; ')}`
		);
	}

	return { block: lines.length ? `\n${lines.join('\n')}` : '', invitable };
}

/**
 * Compute the post-reply proof-request state. Returns undefined when nothing
 * changed. Pure — persistence is the caller's job.
 */
function nextProofState(
	prev: ProofRequestState | null,
	parsed: { proofRequest?: string | null; proofRefusal?: boolean },
	invitable: ProofRequestCategory[]
): ProofRequestState | undefined {
	const now = new Date().toISOString();

	// A fulfilled request was acknowledged this turn → close it out.
	if (prev?.status === 'fulfilled') {
		return {
			...prev,
			status: 'closed',
			resolved_at: now,
			history: [...(prev.history ?? []), { category: prev.category, outcome: 'fulfilled', at: now }],
		};
	}

	// He declined the open request → refused, permanently. Context only — this
	// must never feed trust or match scoring.
	if (parsed.proofRefusal === true && prev && isProofRequestActive(prev)) {
		return {
			...prev,
			status: 'refused',
			resolved_at: now,
			history: [...(prev.history ?? []), { category: prev.category, outcome: 'refused', at: now }],
		};
	}

	// Bestie invited a new proof → open a pending request (one at a time; only
	// categories we explicitly offered are honoured).
	const requested = (parsed.proofRequest ?? '').toString().trim() as ProofRequestCategory;
	if (requested && invitable.includes(requested) && !(prev && isProofRequestActive(prev))) {
		return {
			category: requested,
			status: 'pending',
			asked_at: now,
			attempts: 0,
			resolved_at: null,
			history: prev?.history ?? [],
		};
	}

	return undefined;
}

/**
 * Drop a trailing question sentence. The checklist auto-wraps when the last open
 * item is marked done (nextChecklistState: `allDone`), which can happen on a turn
 * where the model still asked a natural follow-up — appending the hand-off line
 * onto that produced a "question + goodbye" contradiction (§F). Trimming the
 * trailing question lets the wrap turn close cleanly. Prior reaction sentences
 * are kept; a reply that was ONLY a question collapses to '' (closing line stands
 * alone).
 */
function dropTrailingQuestion(text: string): string {
	const t = text.trimEnd();
	if (!t.endsWith('?')) return text;
	const cut = Math.max(t.lastIndexOf('. '), t.lastIndexOf('! '), t.lastIndexOf('? ', t.length - 2));
	return cut === -1 ? '' : t.slice(0, cut + 1).trimEnd();
}

function formatStructuredPreferences(prefs: PreferencesProfile | null, hardNos: string[] = []): string {
	const p = prefs ?? ({
		emotionalSignals: [], lifestyleSignals: [], maturitySignals: [],
		boundaries: [], dealbreakers: [], privateCompatibilityNotes: [],
	} as unknown as PreferencesProfile);
	const lines: string[] = ['\nHer known preferences:'];
	if (p.emotionalSignals.length > 0) lines.push(`- Emotional signals she values: ${p.emotionalSignals.join(', ')}`);
	if (p.lifestyleSignals.length > 0) lines.push(`- Lifestyle signals she values: ${p.lifestyleSignals.join(', ')}`);
	if (p.maturitySignals.length > 0) lines.push(`- Maturity signals she values: ${p.maturitySignals.join(', ')}`);
	if (p.boundaries.length > 0) lines.push(`- Her firm boundaries: ${p.boundaries.join(', ')}`);
	// Declared hard_nos ∪ ai_assistant_profiles.dealbreakers (AI overlay) — keep both.
	const dealbreakers = Array.from(new Set([...hardNos, ...p.dealbreakers]));
	if (dealbreakers.length > 0) lines.push(`- Her dealbreakers (absolute no-gos): ${dealbreakers.join(', ')}`);
	if (p.privateCompatibilityNotes.length > 0) lines.push(`- Private notes: ${p.privateCompatibilityNotes.join(', ')}`);
	return lines.join('\n');
}

/**
 * Generate a Bestie reply. Fetches preferences, match artifacts, and recent
 * conversation history from the DB. Does NOT send — returns the parsed result.
 *
 * @param userId  the female user (whose voice Bestie writes in)
 * @param matchId the conversation/match id
 * @param lastMessage the message just received from the match
 */
export async function generateBestieReply(
	userId: string,
	matchId: string,
	lastMessage: string,
	timing?: { claudeMs?: number },
	opts?: { proofAckCategory?: string }
): Promise<BestieReply> {
	const supabase = getSupabase();

	// These four reads are independent — run them concurrently rather than in
	// series. Cutting ~4 sequential DB round-trips to one parallel batch is a
	// meaningful chunk of the perceived "Bestie reply" delay.
	const [user, matchRow, structuredPrefs, recent] = await Promise.all([
		supabase
			.from('verified_vibe_users')
			.select('first_name, preferences, about, looking, hard_nos')
			.eq('id', userId)
			.single()
			.then((r) => r.data),
		// Cast: generated DB types predate the proof_request / bestie_checklist columns
		// (20260706090000_add_proof_request_to_matches.sql,
		// 20260709120000_add_bestie_checklist_to_matches.sql). Falls back to the legacy
		// column set if a migration hasn't been applied yet, so a deploy-before-
		// migrate window can never null out the match context.
		(supabase as any)
			.from('verified_vibe_matches')
			.select('user1_id, user2_id, proof_request, bestie_checklist')
			.eq('id', matchId)
			.single()
			.then(async (r: any) => {
				if (r.data) return r.data as { user1_id: string; user2_id: string; proof_request?: unknown; bestie_checklist?: unknown };
				const legacy = await supabase
					.from('verified_vibe_matches')
					.select('user1_id, user2_id')
					.eq('id', matchId)
					.single();
				return legacy.data as { user1_id: string; user2_id: string; proof_request?: unknown; bestie_checklist?: unknown } | null;
			}),
		loadPreferences(userId).catch(() => null),
		supabase
			.from('verified_vibe_messages')
			.select('content, sender_id, created_at')
			.eq('match_id', matchId)
			.order('created_at', { ascending: false })
			.limit(12)
			.then((r) => r.data),
	]);

	const userName: string = (user as any)?.first_name || 'her';

	// Resolve the match (other user) and their name + artifacts. Both reads
	// depend on otherUserId, so they run in parallel once the match is known.
	let matchName = 'him';
	let maleArtifactContext = '';
	let maleAbout = '';
	let provenTags: string[] = [];
	let otherUserId: string | null = null;
	let verifiedCategories: string[] = [];
	// Hand-off gate inputs (§3): her preference weights + his proven vectors, so we
	// don't sell him to her on talk alone when she values something he hasn't proven.
	let herWeights: Vec | null = null;
	let hisAttrs: Vec | null = null;
	let hisConf: Vec | null = null;
	// Her other matched men's appeal toward her — the "stack" his rank is measured
	// against, for the concrete proof payoff ("proving X moves you from #4 to #2").
	let rivalAppeals: number[] = [];
	if (matchRow) {
		const partnerId = matchRow.user1_id === userId ? matchRow.user2_id : matchRow.user1_id;
		otherUserId = partnerId;
		const [otherUser, proofSignals, herVec, hisVec] = await Promise.all([
			supabase
				.from('verified_vibe_users')
				.select('first_name, about')
				.eq('id', partnerId)
				.single()
				.then((r) => r.data),
			// Merged view of BOTH proof sources (pipeline verifiedProofs + legacy
			// user_artifacts) — see proof-signals.ts.
			loadProofSignals(supabase, partnerId),
			supabase.from('vv_user_vectors').select('weights').eq('user_id', userId).maybeSingle().then((r: any) => r.data),
			supabase.from('vv_user_vectors').select('attributes, confidence').eq('user_id', partnerId).maybeSingle().then((r: any) => r.data),
		]);
		matchName = otherUser?.first_name || 'him';
		maleAbout = ((otherUser as any)?.about ?? '').toString().slice(0, 240);
		verifiedCategories = proofSignals.categories;
		herWeights = (herVec?.weights ?? null) as Vec | null;
		hisAttrs = (hisVec?.attributes ?? null) as Vec | null;
		hisConf = (hisVec?.confidence ?? null) as Vec | null;

		// Build her stack: appeal of every OTHER man she's matched with, toward her.
		if (herWeights) {
			const { data: herMatches } = await supabase
				.from('verified_vibe_matches')
				.select('user1_id, user2_id')
				.or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
				.eq('status', 'mutual');
			const rivalIds = (herMatches ?? [])
				.map((m: any) => (m.user1_id === userId ? m.user2_id : m.user1_id))
				.filter((id: string) => id !== partnerId);
			if (rivalIds.length > 0) {
				const { data: rivalVecs } = await supabase
					.from('vv_user_vectors')
					.select('attributes, confidence')
					.in('user_id', rivalIds);
				rivalAppeals = (rivalVecs ?? [])
					.filter((v: any) => v.attributes)
					.map((v: any) => appeal(herWeights as Vec, v.attributes as Vec, (v.confidence ?? {}) as Vec));
			}
		}

		if (proofSignals.lines.length > 0) {
			provenTags = proofSignals.lines;
			maleArtifactContext = `\n\n${matchName} has VERIFIED proofs on his profile (real, checked evidence — acknowledge positively when relevant, never re-ask for these):\n${proofSignals.lines.map((l) => `- ${l}`).join('\n')}`;
		}
	}

	// Preferences context
	let preferencesContext = '';
	if (user) {
		const prefs = (user as any).preferences || {};
		const aboutText = (user as any).about ? `\nAbout her: ${(user as any).about}` : '';
		const lookingText = (user as any).looking ? `\nLooking for: ${(user as any).looking}` : '';
		const prefsText = Object.keys(prefs).length > 0 ? `\nHer preferences: ${JSON.stringify(prefs)}` : '';
		preferencesContext = aboutText + lookingText + prefsText;
	}

	const hardNos: string[] = Array.isArray((user as any)?.hard_nos)
		? ((user as any).hard_nos as unknown[]).map((h) => `${h}`.trim()).filter(Boolean)
		: [];
	let structuredPreferencesContext = '';
	const hasStructured = structuredPrefs && (structuredPrefs.emotionalSignals.length > 0 || structuredPrefs.dealbreakers.length > 0 || structuredPrefs.boundaries.length > 0);
	if (hardNos.length > 0 || hasStructured) {
		structuredPreferencesContext = formatStructuredPreferences(structuredPrefs, hardNos);
	}

	// Recent conversation history (last 12 messages)
	let transcript = '';
	const msgs = (recent ?? []).slice().reverse();
	if (msgs.length > 0) {
		const lines = msgs.map((m: any) => `${m.sender_id === userId ? userName : matchName}: ${m.content}`);
		transcript = `\n\nCONVERSATION SO FAR (most recent last) — do NOT repeat questions already asked or re-raise topics already settled:\n${lines.join('\n')}\n`;
	}

	// Is this the FIRST Bestie message in this thread? (No message from her side
	// exists yet — only his opener.) The first turn gets the gap-aware ally opener.
	const isOpener = !(recent ?? []).some((m: any) => m.sender_id === userId);

	// Gap-aware opener context: what she values vs. what he's already shown, so the
	// opener can warmly draw out the ONE thing he hasn't surfaced — never a checklist.
	// Heuristic from data we already have (her valued signals + his proofs + his bio);
	// when the ADVISOR_VECTORS path-plan (pathGaps) is live it can supply a sharper gap.
	let openerContext = '';
	if (isOpener) {
		const valued = structuredPrefs
			? [...structuredPrefs.emotionalSignals, ...structuredPrefs.lifestyleSignals, ...structuredPrefs.maturitySignals]
			: [];
		const valuedLine = valued.length ? valued.join(', ') : '(none recorded yet — open warm and ally-toned with one light question)';
		const provenLine = provenTags.length ? provenTags.join(', ') : 'nothing verified on his profile yet';
		const bioLine = maleAbout || '(no bio yet)';
		openerContext =
			`\n\nOPENER CONTEXT (shapes your first message only — never quote it back verbatim):` +
			`\n- What ${userName} values: ${valuedLine}` +
			`\n- What ${matchName} has already shown/proven: ${provenLine}` +
			`\n- ${matchName}'s bio: ${bioLine}` +
			`\nThe gap to draw out = the ONE thing ${userName} values that ${matchName} hasn't surfaced or proven yet.`;
	}

	// In-chat proof request state for this match (Bestie-driven; category always
	// comes from HER question, never a picker).
	const proofState = ((matchRow as any)?.proof_request ?? null) as ProofRequestState | null;
	const { block: proofRequestContext, invitable } = buildProofRequestBlock({
		state: proofState,
		matchName,
		verifiedCategories,
		isOpener,
	});

	// Proactive, preference-targeted proof invites (§11a): the proofs SHE values most
	// that he hasn't proven, with the concrete rank payoff — invited even without a
	// topic trigger. Never promises she'll step in. '' when no vectors / nothing to ask.
	const { block: proofInviteContext } = buildProofInviteContext({
		herWeights,
		hisAttrs,
		hisConf,
		rivalAppeals,
		allowed: invitable,
		matchName,
		userName,
	});

	// Bestie checklist (gap analysis, spec §D/§F). If a checklist already exists,
	// inject its open items so this turn can mark them done / wrap up. If it does NOT
	// exist yet and this is the first Bestie turn, we generate it CONCURRENTLY with
	// the reply below (the reply prompt has no checklist context on that turn, so
	// they're independent — running them in parallel adds no wall-clock latency).
	const existingChecklist = ((matchRow as any)?.bestie_checklist ?? null) as BestieChecklist | null;
	// Active checklist → draw out the open items. Wrapped checklist → HAND-OFF PHASE:
	// reactive mode (she's already handed off, now just answers his questions). These
	// are mutually exclusive.
	const { block: checklistContext } = buildChecklistBlock(existingChecklist);
	const handoffContext =
		existingChecklist?.status === 'wrapped' ? buildHandoffPhaseBlock(userName, matchName) : '';
	// Generate a checklist whenever one is MISSING — not only on the opener turn.
	// This makes gap-vetting repeatable (spec §F): on reactivation we clear the
	// checklist to re-vet against her current preferences (see the reactivate
	// endpoint), and it also self-heals matches whose opener failed to persist one.
	// A 'wrapped' checklist is not regenerated (it's non-null); the woman stepping
	// in flips Bestie off, so this only fires while she's still delegating.
	const shouldGenerateChecklist = !existingChecklist;

	const client = getClaudeClient();
	const tClaude = Date.now();

	const replyPromise = client.messages.create({
		model: CLAUDE_MODEL,
		max_tokens: 400,
		messages: [
			{
				role: 'user',
				content: buildBestieReplyPrompt({
					userName,
					matchName,
					contextBlock: `${preferencesContext}${structuredPreferencesContext}${maleArtifactContext}${openerContext}`,
					transcript,
					lastMessage,
					// A proof-ack turn is never an opener even if the message read is empty.
					isOpener: opts?.proofAckCategory ? false : isOpener,
					proofRequestContext,
					proofInviteContext,
					checklistContext,
					handoffContext,
					proofAckCategory: opts?.proofAckCategory ?? ''
				})
			}
		]
	});

	const checklistPromise: Promise<BestieChecklist | null> = shouldGenerateChecklist
		? client.messages
				.create({
					model: CLAUDE_MODEL,
					max_tokens: 300,
					messages: [
						{
							role: 'user',
							content: buildBestieChecklistPrompt({
								userName,
								matchName,
								valued: (structuredPrefs
									? [
											...structuredPrefs.emotionalSignals,
											...structuredPrefs.lifestyleSignals,
											...structuredPrefs.maturitySignals
									  ]
									: []
								).join(', ') || '(nothing specific recorded yet)',
								proven: provenTags.length ? provenTags.join(', ') : 'nothing verified on his profile yet',
								bio: maleAbout || '(no bio yet)',
								maxItems: CHECKLIST_MAX_ITEMS
							})
						}
					]
				})
				.then((m) => {
					const c = m.content[0];
					if (c.type !== 'text') return null;
					const txt = c.text.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
					try {
						const p = JSON.parse(txt) as { items?: Array<{ id?: unknown; label?: unknown }> };
						return buildChecklist(p.items);
					} catch {
						return null;
					}
				})
				.catch(() => null)
		: Promise.resolve(null);

	const [message, newChecklist] = await Promise.all([replyPromise, checklistPromise]);

	if (timing) timing.claudeMs = Date.now() - tClaude;

	const content = message.content[0];
	if (content.type !== 'text') throw new Error('Unexpected response type from Claude');
	const raw = content.text.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
	// Accept the legacy "suggestedQuestion" key in case a stale prompt or cached
	// model output still produces it.
	const parsed = JSON.parse(raw) as Partial<BestieReply> & {
		suggestedQuestion?: string;
		proofRequest?: string | null;
		proofRefusal?: boolean;
		itemsDone?: unknown;
		wrapUp?: unknown;
	};

	const proofStateUpdate = nextProofState(proofState, parsed, invitable);

	// Checklist update: a freshly-created checklist (opener turn) takes precedence;
	// otherwise apply the items this turn marked done / any wrap-up to the existing one.
	let checklistUpdate: BestieChecklist | undefined;
	if (newChecklist) {
		checklistUpdate = newChecklist;
	} else {
		checklistUpdate = nextChecklistState(existingChecklist, {
			itemsDone: parsed.itemsDone,
			wrapUp: parsed.wrapUp
		});
	}

	let finalReply = stripBannedDashes(parsed.reply ?? parsed.suggestedQuestion ?? '');
	let proofStateFinal = proofStateUpdate;

	// Did this turn try to wrap up (→ hand off to her)?
	const wantsWrap =
		checklistUpdate?.status === 'wrapped' && existingChecklist?.status !== 'wrapped';

	// HAND-OFF GATE (§3 "verification is the floor-raiser"): never hand a man off on
	// conversation alone when she VALUES a provable dimension he has CLAIMED but not
	// PROVEN (income is the canonical case). Hold the wrap, keep vetting, invite the
	// proof. Degrades to the old behaviour when we have no vectors / the gate is off.
	const gate = wantsWrap
		? assessHandoffReadiness({
				herWeights,
				hisAttrs,
				hisConf,
				verifiedCategories,
				refusedCategories: refusedCategories(proofState)
		  })
		: null;

	if (wantsWrap && gate && !gate.ready) {
		// Block the hand-off: HOLD the checklist active (hold:true so the concurrency
		// merge doesn't auto-wrap an all-done-but-unproven checklist) and pivot to a
		// warm proof ask.
		if (checklistUpdate) checklistUpdate = { ...checklistUpdate, status: 'active', wrapped_at: null, hold: true };
		finalReply = dropTrailingQuestion(finalReply);
		// Only ISSUE the ask (and open a request) when none is already live — don't nag
		// if we already invited this proof on a prior turn.
		const canOpen =
			!!gate.requestCategory && !isProofRequestActive(proofState) && proofState?.status !== 'fulfilled';
		if (canOpen) {
			const ask = handoffProofAskLine(gate.blockingPhrase);
			finalReply = finalReply ? `${finalReply} ${ask}` : ask;
			proofStateFinal = {
				category: gate.requestCategory as ProofRequestCategory,
				status: 'pending',
				asked_at: new Date().toISOString(),
				attempts: 0,
				resolved_at: null,
				history: proofState?.history ?? []
			};
		}
		// Never return an empty reply on a blocked wrap turn.
		if (!finalReply) finalReply = handoffProofAskLine(gate.blockingPhrase);
	} else if (wantsWrap) {
		// Cleared the gate → this turn intends to hand off. Release any prior hold
		// (hold:false, explicit so the merge doesn't fall back to a stale held state)
		// and strip a trailing follow-up question so the reaction reads cleanly. The
		// "she'll take it from here" closing line is appended by the SENDER, and only
		// when the checklist ACTUALLY flips to wrapped in the DB — so an overlapping
		// turn can never leave the man handed off without being told.
		if (checklistUpdate) checklistUpdate = { ...checklistUpdate, hold: false };
		finalReply = dropTrailingQuestion(finalReply);
	}

	return {
		signal: parsed.signal ?? '✅',
		read: stripBannedDashes(parsed.read ?? ''),
		reply: finalReply,
		userName,
		...(proofStateFinal ? { proofStateUpdate: proofStateFinal } : {}),
		...(checklistUpdate ? { checklistUpdate } : {})
	};
}

/**
 * Concurrency-safe persist of a checklist transition (fixes the "wrap never fired"
 * bug). A Bestie generation reads the checklist at its START, then spends several
 * seconds in Claude; two overlapping generations for the SAME match would each
 * write from a stale snapshot, and a last-writer-wins update could silently drop a
 * wrap-up. Here we instead: re-read the CURRENT row, merge monotonically
 * (mergeChecklist — done-union + sticky wrap), and write guarded on the row's `rev`
 * (optimistic CAS). On a lost race the guarded update matches 0 rows and we retry
 * from a fresh read. Returns whether THIS call is the one that flipped it to wrapped
 * (so the hand-off notify + closing line fire exactly once). Non-fatal throughout.
 */
async function persistChecklist(
	supabase: any,
	matchId: string,
	incoming: BestieChecklist | undefined
): Promise<{ justWrapped: boolean }> {
	if (!incoming) return { justWrapped: false };
	for (let attempt = 0; attempt < 3; attempt++) {
		const { data: row } = await supabase
			.from('verified_vibe_matches')
			.select('bestie_checklist')
			.eq('id', matchId)
			.maybeSingle();
		const fresh = (row?.bestie_checklist ?? null) as BestieChecklist | null;
		// Already handed off → never regress a wrapped row back to active.
		if (isWrapped(fresh)) return { justWrapped: false };

		const merged = mergeChecklist(fresh, incoming);
		if (!merged) return { justWrapped: false };

		let q = supabase.from('verified_vibe_matches').update({ bestie_checklist: merged }).eq('id', matchId);
		// Optimistic guard: only write if the row is still at the rev we just read.
		if (!fresh) q = q.is('bestie_checklist', null);
		else if (fresh.rev == null) q = q.is('bestie_checklist->>rev', null);
		else q = q.eq('bestie_checklist->>rev', String(fresh.rev));

		const { data: updated, error } = await q.select('id');
		if (error) {
			console.warn('[bestie] checklist CAS write failed (non-fatal):', error.message);
			return { justWrapped: false };
		}
		if (updated && updated.length > 0) {
			return { justWrapped: isWrapped(merged) && !isWrapped(fresh) };
		}
		// 0 rows → a concurrent turn advanced the row; retry from a fresh read.
	}
	console.warn('[bestie] checklist CAS exhausted retries (non-fatal) for', matchId);
	return { justWrapped: false };
}

/**
 * Generate AND send a Bestie reply server-side: stores the coaching read/signal
 * on the triggering message, then inserts the reply as a message from the user
 * (is_ai = true). Safe to call fire-and-forget.
 *
 * @param userId       the female user Bestie acts for
 * @param matchId      conversation id
 * @param triggerMsgId the match's message that triggered this (to attach coaching)
 * @param lastMessage  text of that message
 */
export async function generateAndSendBestieReply(
	userId: string,
	matchId: string,
	triggerMsgId: string,
	lastMessage: string,
	triggerCreatedAt?: string
): Promise<void> {
	const supabase = getSupabase();
	const timing: { claudeMs?: number } = {};
	const t0 = Date.now();
	const reply = await generateBestieReply(userId, matchId, lastMessage, timing);

	// Persist any proof-request state change this turn produced (invite opened /
	// refusal registered / fulfilled request closed). Non-fatal; conversational
	// state only — never feeds trust or match scoring.
	if (reply.proofStateUpdate) {
		try {
			await (supabase as any)
				.from('verified_vibe_matches')
				.update({ proof_request: reply.proofStateUpdate })
				.eq('id', matchId);
		} catch (e) {
			console.warn('[bestie] proof_request persist failed (non-fatal):', e);
		}
	}

	// Persist any checklist change (items done / wrap-up) with concurrency-safe CAS.
	// When this turn is the one that WRAPPED UP the checklist (§F), run the hand-off:
	// the man's chat freezes (send route reads bestie_checklist) and the woman is
	// notified. justWrapped comes from the persist so it reflects the ACTUAL DB
	// transition, not this turn's possibly-stale snapshot.
	let justWrapped = false;
	if (reply.checklistUpdate) {
		try {
			({ justWrapped } = await persistChecklist(supabase, matchId, reply.checklistUpdate));
		} catch (e) {
			console.warn('[bestie] bestie_checklist persist failed (non-fatal):', e);
		}
	}

	// Attach the coaching card (read/signal) to the triggering message so the
	// female user sees it when she opens the chat.
	try {
		await (supabase as any)
			.from('verified_vibe_messages')
			.update({ ai_signal: reply.signal, ai_read: reply.read })
			.eq('id', triggerMsgId);
	} catch { /* non-critical */ }

	// Append the guaranteed hand-off closing line ONLY when this turn actually flipped
	// the checklist to wrapped in the DB (§F). Decided post-persist so it can never be
	// lost or duplicated by an overlapping turn; the includes() guard is belt-and-braces.
	let replyText = reply.reply;
	if (justWrapped) {
		const closing = handoffClosingLine(reply.userName ?? 'she');
		if (!replyText) replyText = closing;
		else if (!replyText.includes('take it from here')) replyText = `${replyText} ${closing}`;
	}

	// Send the reply as a message from the user, flagged as AI.
	let replyMessageId: string | null = null;
	let generatedAt: string | null = null;
	if (replyText) {
		const { data: inserted } = await (supabase as any)
			.from('verified_vibe_messages')
			.insert({
				match_id: matchId,
				sender_id: userId,
				content: replyText,
				is_ai: true
			})
			.select('id, created_at')
			.single();
		replyMessageId = inserted?.id ?? null;
		generatedAt = inserted?.created_at ?? null;
	}

	// Record server-side latency for the AI Latency dashboard. The reply is now
	// in the DB, so generationMs is the full server cost the user waited on
	// (DB reads + Claude + writes). Upsert by reply_message_id so the recipient's
	// client can later merge in the delivery/render stages. Non-fatal.
	if (replyMessageId) {
		try {
			const generationMs = Date.now() - t0;
			const waitedFromUserMsgMs = triggerCreatedAt && generatedAt
				? Math.max(0, new Date(generatedAt).getTime() - new Date(triggerCreatedAt).getTime())
				: null;
			await (supabase as any)
				.from('vv_ai_response_timings')
				.upsert({
					reply_message_id: replyMessageId,
					match_id: matchId,
					response_type: 'bestie',
					trigger_message_id: triggerMsgId,
					trigger_at: triggerCreatedAt ?? null,
					generated_at: generatedAt,
					generation_ms: generationMs,
					claude_ms: timing.claudeMs ?? null,
					waited_from_user_msg_ms: waitedFromUserMsgMs
				}, { onConflict: 'reply_message_id' });
		} catch (e) {
			console.error('[ai-timing] failed to record server timing (non-fatal):', e);
		}
	}

	// Hand-off (spec §F/§K, Option A): Bestie has wrapped up. Her reply above already
	// told the man she'll bring the woman in; the man's chat is now frozen server-side
	// (send route reads bestie_checklist.status). Notify the woman so she comes to step in.
	if (justWrapped) {
		await notifyWomanToStepIn(supabase, matchId, userId);
	}
}

/**
 * Wrap-up hand-off notification: push the woman a "your turn to step in" prompt
 * that deep-links to the frozen conversation. Best-effort and non-fatal — a
 * missing device token or FCM failure must never break the reply flow. The
 * in-app popup she sees on open is driven separately by bestie_checklist.status.
 */
async function notifyWomanToStepIn(
	supabase: ReturnType<typeof getSupabase>,
	matchId: string,
	womanId: string
): Promise<void> {
	try {
		const [{ data: tokenRow }, { data: matchRow }] = await Promise.all([
			(supabase as any)
				.from('device_tokens')
				.select('token')
				.eq('user_id', womanId)
				.order('created_at', { ascending: false })
				.limit(1)
				.maybeSingle(),
			supabase.from('verified_vibe_matches').select('user1_id, user2_id').eq('id', matchId).single()
		]);
		if (!tokenRow?.token) return;

		const manId = matchRow
			? matchRow.user1_id === womanId
				? matchRow.user2_id
				: matchRow.user1_id
			: null;
		let manName = 'your match';
		if (manId) {
			const { data: man } = await supabase
				.from('verified_vibe_users')
				.select('first_name')
				.eq('id', manId)
				.single();
			manName = (man as any)?.first_name || manName;
		}

		const payload = buildNotificationPayload({
			token: tokenRow.token,
			title: '✨ Your turn to step in',
			body: `AI Bestie got to know ${manName} for you. Reply now to take it from here.`,
			type: 'follow_up_prompt',
			// Land her on the Messages/chat list, where the hand-off popup (with Reply
			// + Review) fires — not straight into his thread, so she gets the choice.
			deepLink: `/messages`
		});
		await sendNotification(payload);
	} catch (e) {
		console.error('[bestie] wrap-up notify failed (non-fatal):', e);
	}
}

/**
 * Proactively send the AI Bestie's FIRST message on a freshly-formed match — the
 * woman's Bestie reaches out to the man BEFORE he says anything ("Bestie speaks
 * first"). Resolves the woman (owner) and man (recipient) from the match, builds
 * the gap-aware opener (the isOpener path in generateBestieReply, with no incoming
 * message), and inserts it as an is_ai message in the woman's voice.
 *
 * Idempotent and non-fatal by design — safe to call fire-and-forget at ANY match-
 * creation site. It no-ops when: Bestie is off on the match, neither side is a
 * woman, or the thread already has a message (so it can never double-open or stomp
 * a conversation that's already started).
 *
 * @param matchId the freshly-created mutual match
 */
export async function generateAndSendBestieOpener(matchId: string): Promise<void> {
	const supabase = getSupabase();
	try {
		const { data: matchRow } = await supabase
			.from('verified_vibe_matches')
			.select('user1_id, user2_id, ai_bestie_active')
			.eq('id', matchId)
			.single();
		if (!matchRow) return;
		// Bestie explicitly off on this match → respect it. (null/undefined = default-on.)
		if ((matchRow as any).ai_bestie_active === false) return;

		// Resolve which side is the woman (Bestie's owner) and which is the man.
		const ids = [matchRow.user1_id, matchRow.user2_id];
		const { data: users } = await supabase
			.from('verified_vibe_users')
			.select('id, gender')
			.in('id', ids);
		const woman = (users ?? []).find((u: any) => u.gender === 'woman');
		const man = (users ?? []).find((u: any) => u.gender === 'man');
		if (!woman || !man) return; // Bestie only proxies woman → man

		// Idempotency: never open a thread that already has any message.
		const { count } = await supabase
			.from('verified_vibe_messages')
			.select('id', { count: 'exact', head: true })
			.eq('match_id', matchId);
		if ((count ?? 0) > 0) return;

		const timing: { claudeMs?: number } = {};
		const t0 = Date.now();
		// Empty lastMessage → generateBestieReply runs the proactive opener path
		// (isOpener is true since no owner-side message exists yet). This turn also
		// generates the CHECKLIST concurrently, so persist it if present.
		const reply = await generateBestieReply(woman.id, matchId, '', timing);
		if (reply.checklistUpdate) {
			// Concurrency-safe create/merge (opener never wraps — all items open).
			try {
				await persistChecklist(supabase, matchId, reply.checklistUpdate);
			} catch { /* non-fatal — checklist will be generated on the man's first turn instead */ }
		}
		if (!reply.reply) return;

		// Re-check right before insert to shrink the double-open race window (e.g. if
		// two creation sites fire for the same match near-simultaneously).
		const { count: count2 } = await supabase
			.from('verified_vibe_messages')
			.select('id', { count: 'exact', head: true })
			.eq('match_id', matchId);
		if ((count2 ?? 0) > 0) return;

		const { data: inserted } = await (supabase as any)
			.from('verified_vibe_messages')
			.insert({ match_id: matchId, sender_id: woman.id, content: reply.reply, is_ai: true })
			.select('id, created_at')
			.single();

		// Best-effort latency record. No trigger message — this is proactive.
		if (inserted?.id) {
			try {
				await (supabase as any)
					.from('vv_ai_response_timings')
					.upsert({
						reply_message_id: inserted.id,
						match_id: matchId,
						response_type: 'bestie',
						generated_at: inserted.created_at ?? null,
						generation_ms: Date.now() - t0,
						claude_ms: timing.claudeMs ?? null
					}, { onConflict: 'reply_message_id' });
			} catch { /* non-critical */ }
		}
	} catch (err) {
		console.error('[bestie-opener] failed (non-fatal):', err);
	}
}

/**
 * Fire the Bestie's acknowledgement turn after a man fulfils an in-chat proof
 * request by UPLOADING (not texting). An upload isn't a message, so nothing else
 * triggers her reply — without this the thread stalls right after "🔒 Verified".
 * Resolves the owner (woman) + man, confirms Bestie is on and the request is
 * fulfilled, generates a warm proof-ack reply, sends it, and closes the request.
 * Non-fatal and idempotent-ish (closing the request means a re-fire no-ops) —
 * safe to call fire-and-forget from the upload route.
 */
export async function generateAndSendBestieProofAck(matchId: string): Promise<void> {
	const supabase = getSupabase();
	try {
		const { data: matchRow } = await (supabase as any)
			.from('verified_vibe_matches')
			.select('user1_id, user2_id, ai_bestie_active, proof_request, status')
			.eq('id', matchId)
			.single();
		if (!matchRow) return;
		if (matchRow.ai_bestie_active === false) return;
		if (matchRow.status === 'unmatched' || matchRow.status === 'blocked') return;
		const proof = matchRow.proof_request as { category?: string; status?: string } | null;
		// Only ack a JUST-fulfilled request; anything else (pending/closed/refused) no-ops.
		if (proof?.status !== 'fulfilled' || !proof.category) return;

		const ids = [matchRow.user1_id, matchRow.user2_id];
		const { data: users } = await supabase
			.from('verified_vibe_users')
			.select('id, gender')
			.in('id', ids);
		const woman = (users ?? []).find((u: any) => u.gender === 'woman');
		if (!woman) return; // Bestie only proxies the woman

		const timing: { claudeMs?: number } = {};
		const t0 = Date.now();
		const reply = await generateBestieReply(woman.id, matchId, '', timing, {
			proofAckCategory: proof.category
		});

		// Close the fulfilled request now it's been acknowledged (fulfilled → closed),
		// and persist any checklist movement. Both non-fatal, conversational-state only.
		if (reply.proofStateUpdate) {
			try {
				await (supabase as any)
					.from('verified_vibe_matches')
					.update({ proof_request: reply.proofStateUpdate })
					.eq('id', matchId);
			} catch (e) { console.warn('[bestie-proof-ack] proof_request persist failed (non-fatal):', e); }
		}
		// A proof-ack turn can be the one that clears the last gap and wraps up
		// (the proof he just uploaded was the thing she valued). Persist via CAS and
		// hand off if it flips to wrapped.
		let justWrapped = false;
		if (reply.checklistUpdate) {
			try {
				({ justWrapped } = await persistChecklist(supabase, matchId, reply.checklistUpdate));
			} catch (e) { console.warn('[bestie-proof-ack] checklist persist failed (non-fatal):', e); }
		}

		let replyText = reply.reply;
		if (justWrapped) {
			const closing = handoffClosingLine(reply.userName ?? 'she');
			if (!replyText) replyText = closing;
			else if (!replyText.includes('take it from here')) replyText = `${replyText} ${closing}`;
		}
		if (!replyText) return;

		const { data: inserted } = await (supabase as any)
			.from('verified_vibe_messages')
			.insert({ match_id: matchId, sender_id: woman.id, content: replyText, is_ai: true })
			.select('id, created_at')
			.single();

		if (inserted?.id) {
			try {
				await (supabase as any)
					.from('vv_ai_response_timings')
					.upsert({
						reply_message_id: inserted.id,
						match_id: matchId,
						response_type: 'bestie',
						generated_at: inserted.created_at ?? null,
						generation_ms: Date.now() - t0,
						claude_ms: timing.claudeMs ?? null
					}, { onConflict: 'reply_message_id' });
			} catch { /* non-critical */ }
		}

		// If acknowledging the proof cleared the last gap, hand off to the woman.
		if (justWrapped) await notifyWomanToStepIn(supabase, matchId, woman.id);
	} catch (err) {
		console.error('[bestie-proof-ack] failed (non-fatal):', err);
	}
}
