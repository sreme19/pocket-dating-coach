/**
 * Day-90 anonymization + photo-purge for soft-deleted accounts.
 *
 * Soft-delete retains everything (see delete-user.ts). This job runs the second
 * stage: for users whose deleted_at is older than the retention window (90 days)
 * and who have not been anonymized yet, it
 *
 *   1. purges their photos + voice samples from storage,
 *   2. strips / coarsens direct identifiers on verified_vibe_users,
 *   3. removes name / photos / identity from the user_master_profile JSONB blob,
 *   4. scrubs the auth.users email/phone/metadata (the login stays BANNED, not
 *      deleted, so the ai_assistant_* conversations survive — but the PII on the
 *      auth record must go),
 *   5. assigns a random research_id and stamps anonymized_at.
 *
 * What survives (anonymized, for product improvement): structured preferences /
 * hard_nos, trust/score columns, archetype, gender, coarsened age, city, and all
 * behavioural / AI / match rows keyed by the now-pseudonymous user id.
 *
 * Idempotent: the `anonymized_at IS NULL` filter means re-running never
 * re-processes a row. Per-user failures are isolated so one bad row can't halt
 * the batch.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '$lib/server/supabase';

const RETENTION_DAYS = 90;
const PROFILES_BUCKET = 'profiles';
const VOICE_BUCKET = 'voice-samples';

export interface AnonymizeOptions {
	/** Retention window in days; rows soft-deleted longer ago are anonymized. */
	olderThanDays?: number;
	/** Cap how many users to process in one run. */
	limit?: number;
	/** When true, report what would happen without mutating anything. */
	dryRun?: boolean;
}

export interface AnonymizeReport {
	window_days: number;
	candidates: number;
	anonymized: number;
	failed: number;
	dryRun: boolean;
	results: Array<{
		userId: string;
		ok: boolean;
		photosRemoved?: number;
		error?: string;
	}>;
}

/** Extract the object path inside `profiles` from a Supabase public URL. */
function profilesObjectPath(url: unknown): string | null {
	if (typeof url !== 'string') return null;
	const marker = `/object/public/${PROFILES_BUCKET}/`;
	const i = url.indexOf(marker);
	if (i === -1) return null;
	const rest = url.slice(i + marker.length);
	const path = rest.split('?')[0];
	return path ? decodeURIComponent(path) : null;
}

/** List every object under a folder prefix in a bucket (one level, non-recursive). */
async function listFolder(
	db: SupabaseClient<any>,
	bucket: string,
	prefix: string
): Promise<string[]> {
	const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000 });
	if (error || !data) return [];
	return data.filter((o: any) => o.name && o.id !== null).map((o: any) => `${prefix}/${o.name}`);
}

/** Floor an age to a 5-year band (age is NOT NULL, so we coarsen rather than clear). */
function bandAge(age: unknown): number {
	const n = typeof age === 'number' && Number.isFinite(age) ? age : 18;
	return Math.max(18, Math.floor(n / 5) * 5);
}

async function anonymizeOne(
	db: SupabaseClient<any>,
	user: { id: string; age: number | null; avatar_url: string | null },
	dryRun: boolean
): Promise<{ userId: string; ok: boolean; photosRemoved?: number; error?: string }> {
	const userId = user.id;
	try {
		// 1. Gather every storage object that could hold this person's face/voice.
		const { data: master } = await db
			.from('user_master_profile')
			.select('data')
			.eq('user_id', userId)
			.maybeSingle();
		const masterData = (master?.data ?? {}) as Record<string, any>;

		const profilesPaths = new Set<string>();
		// URL-referenced objects (AI photos live at ai-photos/<uuid>, not user-keyed).
		for (const p of Array.isArray(masterData.aiPhotos) ? masterData.aiPhotos : []) {
			const path = profilesObjectPath(p?.url);
			if (path) profilesPaths.add(path);
		}
		for (const p of Array.isArray(masterData.photos) ? masterData.photos : []) {
			const path = profilesObjectPath(p?.dataUrl);
			if (path) profilesPaths.add(path);
		}
		const avatarPath = profilesObjectPath(user.avatar_url);
		if (avatarPath) profilesPaths.add(avatarPath);
		// Folder-keyed uploads (raw photos + avatars).
		for (const p of await listFolder(db, PROFILES_BUCKET, `photos/${userId}`)) profilesPaths.add(p);
		for (const p of await listFolder(db, PROFILES_BUCKET, `avatars/${userId}`)) profilesPaths.add(p);

		const voicePaths = await listFolder(db, VOICE_BUCKET, userId);

		const photoCount = profilesPaths.size + voicePaths.length;

		if (dryRun) {
			return { userId, ok: true, photosRemoved: photoCount };
		}

		// 2. Purge storage objects (best-effort; a storage miss must not block scrubbing).
		if (profilesPaths.size) {
			const { error } = await db.storage.from(PROFILES_BUCKET).remove([...profilesPaths]);
			if (error) console.error(`anonymize ${userId}: profiles remove failed:`, error.message);
		}
		if (voicePaths.length) {
			const { error } = await db.storage.from(VOICE_BUCKET).remove(voicePaths);
			if (error) console.error(`anonymize ${userId}: voice remove failed:`, error.message);
		}

		// 3. Scrub the master-profile JSONB: drop name/photos/identity, keep the rest.
		if (master) {
			const scrubbed = { ...masterData };
			delete scrubbed.photos;
			delete scrubbed.aiPhotos;
			delete scrubbed.identity; // name / city / age / DOB live here
			await db.from('user_master_profile').update({ data: scrubbed }).eq('user_id', userId);
		}

		// 4. Scrub the auth record's PII (login stays banned; row is NOT deleted).
		const researchId = crypto.randomUUID();
		try {
			await db.auth.admin.updateUserById(userId, {
				email: `deleted-${researchId}@deleted.invalid`,
				phone: '',
				user_metadata: {},
				app_metadata: {}
			} as any);
		} catch (err) {
			console.error(`anonymize ${userId}: auth scrub failed (continuing):`, err);
		}

		// 5. Strip / coarsen identifiers on the profile row + stamp anonymized_at.
		//    first_name / city are NOT NULL, so they get placeholders / stay coarse.
		const { error: updErr } = await db
			.from('verified_vibe_users')
			.update({
				first_name: 'Deleted',
				age: bandAge(user.age),
				avatar_url: null,
				about: null,
				looking: null,
				here_for_title: null,
				here_for_desc: null,
				research_id: researchId,
				anonymized_at: new Date().toISOString()
			})
			.eq('id', userId);
		if (updErr) {
			return { userId, ok: false, error: `profile scrub failed: ${updErr.message}` };
		}

		return { userId, ok: true, photosRemoved: photoCount };
	} catch (err: any) {
		return { userId, ok: false, error: err?.message ?? String(err) };
	}
}

/**
 * Anonymize every soft-deleted user past the retention window. Safe to re-run.
 */
export async function runAnonymizeDeleted(opts: AnonymizeOptions = {}): Promise<AnonymizeReport> {
	const db = getSupabase() as any;
	const windowDays = opts.olderThanDays ?? RETENTION_DAYS;
	const dryRun = opts.dryRun ?? false;
	const cutoff = new Date(Date.now() - windowDays * 86_400_000).toISOString();

	let q = db
		.from('verified_vibe_users')
		.select('id, age, avatar_url')
		.not('deleted_at', 'is', null)
		.is('anonymized_at', null)
		.lt('deleted_at', cutoff)
		.order('deleted_at', { ascending: true });
	if (opts.limit) q = q.limit(opts.limit);

	const { data: candidates, error } = await q;
	if (error) {
		return {
			window_days: windowDays,
			candidates: 0,
			anonymized: 0,
			failed: 0,
			dryRun,
			results: [{ userId: '(query)', ok: false, error: error.message }]
		};
	}

	const results = [];
	for (const u of candidates ?? []) {
		results.push(await anonymizeOne(db, u, dryRun));
	}

	return {
		window_days: windowDays,
		candidates: (candidates ?? []).length,
		anonymized: results.filter((r) => r.ok && !dryRun).length,
		failed: results.filter((r) => !r.ok).length,
		dryRun,
		results
	};
}
