// ============================================================
// photo-review.ts — admin "AI Photos" review/tagging core
//
// Powers the Test Suite "AI Photos" tab. Two responsibilities:
//   1. List already-generated men's AI photos (from user_master_profile.data
//      .aiPhotos) so a human reviewer can tag each one.
//   2. Persist those human tags to ai_photo_reviews (upsert per reviewer).
//
// Generated-on-demand photos (from the /api/photo-enhance/generate bench) are
// tagged the same way — the client posts their hosted URL with source:'generated'.
// ============================================================

import { getSupabase } from './supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

// Untyped client — ai_photo_reviews and user_master_profile aren't in the
// generated Database types (same pattern as test-suite.ts / tsdb()).
function pdb(): SupabaseClient {
	return getSupabase() as unknown as SupabaseClient;
}

export type IdentityVerdict = 'yes' | 'partial' | 'no';

export interface PhotoReview {
	reviewer: string;
	identity_preserved: IdentityVerdict | null;
	has_artifacts: boolean | null;
	quality: number | null;
	note: string | null;
	updated_at: string | null;
}

export interface OriginalPhoto {
	label: string;
	url: string;
}

export interface PhotoItem {
	userId: string | null;
	userName: string;
	gender: string | null;
	archetype: string | null;
	url: string;
	role: string;
	scene: string;
	source: 'existing' | 'generated';
	updatedAt: string | null;
	/** The user's original uploaded reference photos, for identity comparison. */
	originals: OriginalPhoto[];
	reviews: PhotoReview[];
}

interface AiPhoto {
	url: string;
	role?: string;
	scene?: string;
}

interface RawPhoto {
	label?: string;
	dataUrl?: string;
	url?: string;
}

interface MasterProfileRow {
	user_id: string;
	data: { aiPhotos?: AiPhoto[]; photos?: RawPhoto[] } | null;
	updated_at: string | null;
}

/** Normalize a user's raw uploaded photos to { label, url }, dropping any without a URL. */
function extractOriginals(photos: RawPhoto[] | undefined): OriginalPhoto[] {
	if (!Array.isArray(photos)) return [];
	return photos
		.map((p) => ({ label: p?.label ?? '', url: p?.dataUrl ?? p?.url ?? '' }))
		.filter((p) => !!p.url);
}

/**
 * List every already-generated AI photo across users, newest profile first,
 * each with the human tags applied so far. Only rows that actually carry
 * `data.aiPhotos` are returned (in practice, men — women use real photos).
 */
export async function listGeneratedPhotos(limit = 400): Promise<PhotoItem[]> {
	const sb = pdb();

	const { data: rows, error } = await sb
		.from('user_master_profile')
		.select('user_id, data, updated_at')
		.order('updated_at', { ascending: false })
		.limit(limit);
	if (error) throw new Error(error.message);

	const withPhotos = ((rows ?? []) as MasterProfileRow[]).filter(
		(r) => Array.isArray(r.data?.aiPhotos) && r.data!.aiPhotos!.length > 0
	);
	if (withPhotos.length === 0) return [];

	// Resolve display names + gender for the owners.
	const userIds = [...new Set(withPhotos.map((r) => r.user_id))];
	const { data: users } = await sb
		.from('verified_vibe_users')
		.select('id, first_name, gender, archetype')
		.in('id', userIds);
	const userMap = new Map<string, { first_name: string; gender: string; archetype: string }>(
		((users ?? []) as { id: string; first_name: string; gender: string; archetype: string }[]).map(
			(u) => [u.id, u]
		)
	);

	// Flatten to one entry per photo.
	const photos: Omit<PhotoItem, 'reviews'>[] = [];
	for (const row of withPhotos) {
		const u = userMap.get(row.user_id);
		const originals = extractOriginals(row.data!.photos);
		for (const p of row.data!.aiPhotos!) {
			if (!p?.url) continue;
			photos.push({
				userId: row.user_id,
				userName: u?.first_name ?? '(unknown)',
				gender: u?.gender ?? null,
				archetype: u?.archetype ?? null,
				url: p.url,
				role: p.role ?? '',
				scene: p.scene ?? '',
				source: 'existing',
				updatedAt: row.updated_at,
				originals
			});
		}
	}

	const reviewsByUrl = await fetchReviews(photos.map((p) => p.url));
	return photos.map((p) => ({ ...p, reviews: reviewsByUrl.get(p.url) ?? [] }));
}

/** Fetch all reviews for a set of photo URLs, grouped by URL. */
async function fetchReviews(urls: string[]): Promise<Map<string, PhotoReview[]>> {
	const out = new Map<string, PhotoReview[]>();
	const unique = [...new Set(urls)];
	if (unique.length === 0) return out;

	const sb = pdb();
	// Chunk the IN() list so a large roster doesn't blow past URL/statement limits.
	const CHUNK = 100;
	for (let i = 0; i < unique.length; i += CHUNK) {
		const slice = unique.slice(i, i + CHUNK);
		const { data } = await sb
			.from('ai_photo_reviews')
			.select('photo_url, reviewer, identity_preserved, has_artifacts, quality, note, updated_at')
			.in('photo_url', slice);
		for (const r of (data ?? []) as (PhotoReview & { photo_url: string })[]) {
			const list = out.get(r.photo_url) ?? [];
			list.push({
				reviewer: r.reviewer,
				identity_preserved: r.identity_preserved,
				has_artifacts: r.has_artifacts,
				quality: r.quality,
				note: r.note,
				updated_at: r.updated_at
			});
			out.set(r.photo_url, list);
		}
	}
	return out;
}

export interface SaveReviewInput {
	photoUrl: string;
	userId?: string | null;
	role?: string | null;
	scene?: string | null;
	source?: 'existing' | 'generated';
	identityPreserved?: IdentityVerdict | null;
	hasArtifacts?: boolean | null;
	quality?: number | null;
	note?: string | null;
}

/**
 * Upsert one reviewer's tags for one photo (keyed by photo_url + reviewer).
 * Returns the saved review row.
 */
export async function savePhotoReview(
	input: SaveReviewInput,
	reviewer: string | null
): Promise<PhotoReview> {
	if (!input.photoUrl) throw new Error('photoUrl is required');

	const quality =
		input.quality == null ? null : Math.max(1, Math.min(5, Math.round(input.quality)));

	const row = {
		photo_url: input.photoUrl,
		user_id: input.userId ?? null,
		role: input.role ?? null,
		scene: input.scene ?? null,
		source: input.source ?? 'existing',
		identity_preserved: input.identityPreserved ?? null,
		has_artifacts: input.hasArtifacts ?? null,
		quality,
		note: input.note?.trim() || null,
		reviewer: reviewer && reviewer.trim() ? reviewer.trim() : 'anonymous',
		updated_at: new Date().toISOString()
	};

	const sb = pdb();
	const { data, error } = await sb
		.from('ai_photo_reviews')
		.upsert(row, { onConflict: 'photo_url,reviewer' })
		.select('reviewer, identity_preserved, has_artifacts, quality, note, updated_at')
		.single();
	if (error) throw new Error(error.message);

	return data as PhotoReview;
}
