/**
 * Live vector propagation (Design §11g, §6b). When a user's inputs change — a proof
 * is verified, their profile is edited, or they set their preference weights — their
 * value vectors should be rebuilt so Profile Strength and appeal reflect it PROMPTLY,
 * not only on the nightly/admin backfill. This closes the "vectors only build via the
 * admin task" gap: new users get a vectors row at the end of onboarding (so their
 * Profile Strength card appears), and proofs propagate into confidence right away.
 *
 * Scheduled via `waitUntil` so the triggering request returns immediately while Vercel
 * keeps the function alive to finish the single LLM rebuild. Idempotent and
 * best-effort: buildAndStoreUserVectors never throws, and a failed rebuild simply
 * leaves the user's prior vectors in place.
 *
 * NOTE: this is a per-user rebuild on user-driven events only — it does NOT flip the
 * live scoring/matching path (still gated by MATCHMAKER_V2 / ADVISOR_VECTORS). It just
 * keeps vv_user_vectors fresh so the already-live Profile Strength surface is accurate.
 */
import { waitUntil } from '@vercel/functions';
import { buildAndStoreUserVectors } from './vector-builder';

export function scheduleVectorRebuild(userId: string): void {
	if (!userId) return;
	const task = buildAndStoreUserVectors(userId)
		.then(() => undefined)
		.catch((e) => console.warn('[vector-rebuild] failed (non-fatal):', e));
	try {
		waitUntil(task);
	} catch {
		// Not inside a Vercel request context (tests, cron, local) — the task is
		// already running; just let the floating promise resolve on its own.
	}
}
