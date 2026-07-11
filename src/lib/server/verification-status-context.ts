// ============================================================
// verification-status-context.ts — shared "own verification status" loader
//
// Both advisors (AI Bestie for women, AI Wingman for men) need GROUND TRUTH about
// which of the user's OWN verification steps are actually completed. Without it
// the advisor has no data on the user's verification and hallucinates that it's
// all done (see the AI Bestie "you've done all your verification" bug). This is
// the single source of truth for that block so the two sides never drift.
//
// Read-only. Returns '' only if the query outright fails; otherwise always
// returns a populated block so the advisor can never fall back to guessing.
// ============================================================

import { loadProofSignals } from './proof-signals';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Core verification steps every user is asked to complete, in the order the app
 * presents them. Keys match the `step` column in `verified_vibe_verification`;
 * labels are what the advisor should name to the user. `id` (government ID) is an
 * OPTIONAL trust boost — onboarding no longer collects it — so it's tracked
 * separately as a bonus, never counted as a missing core step. See the
 * verification-steps-model note for the mapping (Identity=liveness etc.).
 */
const CORE_VERIFICATION_STEPS: ReadonlyArray<{ step: string; label: string }> = [
	{ step: 'liveness', label: 'Identity (live selfie)' },
	{ step: 'photos', label: 'Profile photos' },
	{ step: 'spending_or_qa', label: 'Dating-intent Q&A' }
];
const BONUS_VERIFICATION_STEP = { step: 'id', label: 'Government ID' };

export interface VerificationStatusOpts {
	/** Which side the block is for — drives pronouns and the header. */
	subject: 'man' | 'woman';
	/** The user's first name, if known (women have one in context; men usually don't). */
	name?: string;
}

/**
 * Assemble the "<HIS|HER> VERIFICATION STATUS" ground-truth block. A step counts
 * as done only when status = 'completed' — a 'pending'/'under_review' row is NOT
 * done. Also lists the user's own uploaded proofs so the advisor celebrates
 * what's done and never asks for a re-upload.
 */
export async function loadVerificationStatusContext(
	supabase: SupabaseClient,
	userId: string,
	opts: VerificationStatusOpts
): Promise<string> {
	const woman = opts.subject === 'woman';
	const POSS_UP = woman ? 'HER' : 'HIS'; // header + "Her/His uploaded proofs"
	const Poss = woman ? 'Her' : 'His';
	const poss = woman ? 'her' : 'his';
	const subj = woman ? 'she' : 'he';
	const Subj = woman ? 'She' : 'He';
	const obj = woman ? 'her' : 'him';
	const who = opts.name?.trim() || subj; // "Neha" / fallback pronoun

	try {
		const { data: rows } = await (supabase as any)
			.from('verified_vibe_verification')
			.select('step, status')
			.eq('user_id', userId);

		const completed = new Set<string>(
			(rows ?? [])
				.filter((r: any) => r?.status === 'completed')
				.map((r: any) => r.step as string)
		);

		const coreDone = CORE_VERIFICATION_STEPS.filter((s) => completed.has(s.step));
		const coreMissing = CORE_VERIFICATION_STEPS.filter((s) => !completed.has(s.step));
		const idDone = completed.has(BONUS_VERIFICATION_STEP.step);

		const doneLine =
			coreDone.length > 0
				? `- ✅ Completed: ${coreDone.map((s) => s.label).join(', ')}`
				: `- ✅ Completed: none of the core steps yet`;
		const missingLine =
			coreMissing.length > 0
				? `- ⬜ NOT done yet: ${coreMissing.map((s) => s.label).join(', ')}`
				: `- ⬜ NOT done yet: none — all core verification is complete`;
		const bonusLine = `- Government ID (optional boost): ${idDone ? 'added' : 'not added'}`;

		// The user's OWN uploaded proofs — celebrate what's done, never re-ask.
		let proofLine = '';
		try {
			const ps = await loadProofSignals(supabase as any, userId);
			proofLine = ps.lines.length
				? `\n${Poss} uploaded verified proofs (already DONE — never ask ${obj} to re-upload these): ${ps.lines.join('; ')}`
				: `\n${Subj} has not uploaded any lifestyle/show-off proofs yet.`;
		} catch {
			/* skip proofs on failure — core status still stands */
		}

		const allCoreDone = coreMissing.length === 0;
		const coachLine = allCoreDone
			? `Coach from this: ${poss} core verification is genuinely complete — say so honestly and pivot to uploading proofs (📎) and making moves on ${poss} matches. Do NOT invent remaining verification steps.`
			: `Coach from this: when ${subj} asks what to improve or what's left, name the SPECIFIC steps marked "NOT done yet" above and walk ${obj} through them. NEVER claim ${poss} verification is finished while any step is still "NOT done yet".`;

		return `\n\n${POSS_UP} VERIFICATION STATUS (ground truth from ${poss} verification records — this is the ONLY source for what ${who} has and hasn't verified; NEVER claim ${subj} completed a step that is not in the "Completed" list):
${doneLine}
${missingLine}
${bonusLine}${proofLine}
${coachLine}`;
	} catch {
		// Query failed outright — return empty so we don't assert anything false.
		return '';
	}
}
