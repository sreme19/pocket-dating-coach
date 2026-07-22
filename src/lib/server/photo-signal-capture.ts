/**
 * Photo-signal capture — the multimodal analogue of chat-intel-capture.ts.
 *
 * A user's onboarding photos are an evidence source, not decoration. This runs ONE
 * Claude vision call over their REAL uploads (user_master_profile.data.photos — the
 * authentic self-uploads for BOTH genders; men's DISPLAYED photos are AI-generated,
 * but the originals they upload are what we read here), distils bounded signals into
 * data.photoSignals, and — exactly like chat-intel — leaves the actual scoring to the
 * vector builder + trust recompute, which already read that bucket. So there is no
 * separate scoring path: photos feed the CLAIM level v (discounted by confidence) and,
 * ONLY when the authenticity verdict holds, a modest capped confidence/trust boost
 * (see photo-signals.ts for the gameability-safe policy).
 *
 * Cost discipline: one vision call per photo-set CHANGE (guarded by a stable hash),
 * debounced against a rebuild storm. Entirely behind PHOTO_SIGNAL_GATE (off by default).
 */

import { getSupabase } from './supabase';
import {
	PHOTO_SIGNAL_VERSION,
	photoSignalsEnabled,
	photoSetHash,
	type PhotoSignals,
	type PhotoAuthenticity,
	type PhotoDimSignal,
} from './photo-signals';
import { OPEN_DIMENSION_IDS, type DimensionId } from '$lib/verified-vibe/dimensions';

const MAX_PHOTOS = 6;                             // bound the vision call
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;          // skip anything absurdly large
const REBUILD_MIN_INTERVAL_MS = 3 * 60 * 1000;    // debounce rebuilds (mirror chat-intel)

type MediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

interface RawPhoto { label?: string; url?: string; dataUrl?: string }
interface ResolvedImage { media_type: MediaType; data: string }

function mediaFromMime(mime: string): MediaType {
	const m = mime.toLowerCase();
	if (m.includes('png')) return 'image/png';
	if (m.includes('gif')) return 'image/gif';
	if (m.includes('webp')) return 'image/webp';
	return 'image/jpeg';
}

function mediaFromUrl(url: string): MediaType {
	const u = url.toLowerCase();
	if (u.includes('.png')) return 'image/png';
	if (u.includes('.gif')) return 'image/gif';
	if (u.includes('.webp')) return 'image/webp';
	return 'image/jpeg';
}

/** Resolve a stored photo to base64 + media type. dataUrl is inline; url is fetched. */
async function resolveImage(p: RawPhoto): Promise<ResolvedImage | null> {
	const dataUrl = p.dataUrl && p.dataUrl.startsWith('data:') ? p.dataUrl : null;
	if (dataUrl) {
		const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
		if (!m) return null;
		if (m[2].length * 0.75 > MAX_IMAGE_BYTES) return null;
		return { media_type: mediaFromMime(m[1]), data: m[2] };
	}
	const url = p.url ?? (p.dataUrl && /^https?:\/\//.test(p.dataUrl) ? p.dataUrl : null);
	if (!url) return null;
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		const buf = await res.arrayBuffer();
		if (buf.byteLength > MAX_IMAGE_BYTES) return null;
		const ct = res.headers.get('content-type') ?? '';
		const media = ct.startsWith('image/') ? mediaFromMime(ct) : mediaFromUrl(url);
		return { media_type: media, data: Buffer.from(buf).toString('base64') };
	} catch {
		return null;
	}
}

function buildPrompt(): string {
	const dimList = OPEN_DIMENSION_IDS.join(', ');
	return `You are analysing a dating-app user's own uploaded profile photos as an EVIDENCE source. ${'{N}'} photos follow. Judge ONLY what the images actually show — never invent facts, never guess income or job titles that are not visibly evidenced.

Return ONLY minified JSON (no markdown, no code fences):
{
 "dimensions": {  // include ONLY dimensions the photos genuinely support; omit the rest
   "<dimId>": {"level": <0-100 how strongly the photos support this>, "evidence": "<=16 words on what in the photos shows it"}
 },
 "scenes": ["<=8 short scene/context tags, e.g. coffee shop, outdoors, travel, gym, group/social, home, restaurant, pets>"],
 "authenticity": {
   "identityConsistent": <true if it is clearly the same person across photos, or a single clear solo shot>,
   "realNotAi": <true if these read as real photographs, NOT AI-generated/CGI/stock/heavily-filtered>,
   "artifactFree": <true if no warped faces, broken hands, distortion or obvious editing artifacts>,
   "faceClear": <true if at least one clear, front-facing face is visible>,
   "quality": <overall photo-set quality 1-5>
 }
}

Valid dimension ids (use these keys only): ${dimList}.
Guidance: presentation=grooming/style/how put-together; looks=physical attractiveness; warmth=genuine smile/approachability; lifestyle=activities/places/experiences shown; ambition=career or drive VISIBLY evidenced (e.g. professional setting); social_legitimacy=with friends/at real events; family=with family or kids. Be calibrated (50=average, 80+=clear standout) and conservative — if the photos don't show it, omit the dimension.`;
}

function clampLevel(n: unknown): number {
	const x = Number(n);
	if (!isFinite(x)) return 50;
	return Math.max(0, Math.min(100, Math.round(x)));
}
function asBool(v: unknown): boolean { return v === true; }

function parseSignals(raw: string, photoCount: number, photoHash: string): PhotoSignals | null {
	const cleaned = raw.trim()
		.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
	let p: any;
	try { p = JSON.parse(cleaned); } catch { return null; }

	const dims: Partial<Record<DimensionId, PhotoDimSignal>> = {};
	const openSet = new Set<string>(OPEN_DIMENSION_IDS);
	if (p.dimensions && typeof p.dimensions === 'object') {
		for (const [k, v] of Object.entries(p.dimensions as Record<string, any>)) {
			if (!openSet.has(k) || !v || typeof v !== 'object') continue;
			dims[k as DimensionId] = {
				level: clampLevel(v.level),
				evidence: typeof v.evidence === 'string' ? v.evidence.slice(0, 120) : '',
			};
		}
	}

	const rawScenes: unknown[] = Array.isArray(p.scenes) ? p.scenes : [];
	const scenes: string[] = [...new Set(
		rawScenes
			.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
			.map((s) => s.trim().toLowerCase().slice(0, 40))
	)].slice(0, 8);

	const a = (p.authenticity ?? {}) as Record<string, unknown>;
	const q = Number(a.quality);
	const authenticity: PhotoAuthenticity = {
		identityConsistent: asBool(a.identityConsistent),
		realNotAi: asBool(a.realNotAi),
		artifactFree: asBool(a.artifactFree),
		faceClear: asBool(a.faceClear),
		quality: isFinite(q) ? Math.max(1, Math.min(5, Math.round(q))) : 3,
	};

	return {
		dims,
		scenes,
		authenticity,
		photoCount,
		photoHash,
		analyzedAt: new Date().toISOString(),
		version: PHOTO_SIGNAL_VERSION,
	};
}

export interface CaptureOpts {
	/** Run even when the photo set is unchanged (used by the admin backfill). */
	force?: boolean;
	/** Skip scheduling the downstream vector/trust rebuild (backfill does its own). */
	skipRebuild?: boolean;
}

/**
 * Analyse one user's uploaded photos and fold the distilled signals into their master
 * profile, then (unless skipped) schedule a vector rebuild + trust recompute so the
 * claim/confidence/trust changes propagate. Fire-and-forget safe: never throws.
 * Returns the signals it wrote, or null when it did nothing (gate off / no photos /
 * unchanged / vision failure).
 */
export async function capturePhotoSignals(userId: string, opts: CaptureOpts = {}): Promise<PhotoSignals | null> {
	if (!userId) return null;
	if (!photoSignalsEnabled()) return null;

	try {
		const supabase = getSupabase() as any;
		const { data: row } = await supabase
			.from('user_master_profile')
			.select('data')
			.eq('user_id', userId)
			.maybeSingle();
		const data = (row?.data ?? {}) as Record<string, unknown>;

		const photos = (Array.isArray(data.photos) ? data.photos : []) as RawPhoto[];
		if (photos.length === 0) return null;

		const hash = photoSetHash(photos);
		const prev = (data.photoSignals ?? null) as PhotoSignals | null;
		// Skip if the exact same set was already analysed at the current policy version.
		if (!opts.force && prev && prev.photoHash === hash && prev.version === PHOTO_SIGNAL_VERSION) {
			return prev;
		}

		// Resolve up to MAX_PHOTOS images to base64 (sequential — sets are tiny).
		const images: ResolvedImage[] = [];
		for (const p of photos.slice(0, MAX_PHOTOS)) {
			const img = await resolveImage(p);
			if (img) images.push(img);
		}
		if (images.length === 0) return null;

		const { getClaudeClient, CLAUDE_MODEL } = await import('$lib/claude');
		const client = getClaudeClient();
		const content: any[] = [
			{ type: 'text', text: buildPrompt().replace('{N}', String(images.length)) },
			...images.map((im) => ({
				type: 'image',
				source: { type: 'base64', media_type: im.media_type, data: im.data },
			})),
		];
		const response = await client.messages.create({
			model: CLAUDE_MODEL,
			max_tokens: 700,
			messages: [{ role: 'user', content }],
		});
		const block = response.content[0];
		if (!block || block.type !== 'text') return null;

		const signals = parseSignals(block.text, images.length, hash);
		if (!signals) return null;

		// Debounce the downstream (LLM-backed) vector rebuild the way chat-intel does.
		const lastRebuild = prev?.lastRebuildAt ? Date.parse(prev.lastRebuildAt) : 0;
		const shouldRebuild = !opts.skipRebuild && Date.now() - lastRebuild > REBUILD_MIN_INTERVAL_MS;
		signals.lastRebuildAt = shouldRebuild ? new Date().toISOString() : prev?.lastRebuildAt;

		await supabase
			.from('user_master_profile')
			.upsert({ user_id: userId, data: { ...data, photoSignals: signals } }, { onConflict: 'user_id' });

		if (shouldRebuild) {
			// Propagate: claim v + confidence c (vector rebuild) and CG trust boost.
			try {
				const { scheduleVectorRebuild } = await import('./vector-rebuild');
				scheduleVectorRebuild(userId);
			} catch (e) { console.warn('[photo-signals] vector rebuild schedule failed:', e); }
			try {
				const { recomputeAndNormalize } = await import('./trust-normalize');
				const { waitUntil } = await import('@vercel/functions');
				const t = recomputeAndNormalize(userId).then(() => undefined).catch(() => undefined);
				try { waitUntil(t); } catch { /* not in a Vercel request ctx — let it run */ }
			} catch (e) { console.warn('[photo-signals] trust recompute schedule failed:', e); }
		}

		return signals;
	} catch (e) {
		console.warn('capturePhotoSignals failed (non-fatal):', e);
		return null;
	}
}

/**
 * Backfill: analyse photos for a set of users (or all real users). One vision call per
 * user with a photo set. Synchronous per user; recompute is done ONCE at the end by
 * the caller/task, so we pass skipRebuild. Safe to re-run (hash-guarded).
 */
export async function runPhotoSignalBackfill(opts: { userIds?: string[]; includeSeed?: boolean; force?: boolean } = {}): Promise<{
	analysed: number;
	skipped: number;
	failed: number;
	results: Array<{ userId: string; ok: boolean; authentic?: boolean; scenes?: number }>;
}> {
	const db = getSupabase() as any;
	let ids = opts.userIds;
	if (!ids) {
		let q = db.from('verified_vibe_users').select('id').is('deleted_at', null);
		if (!opts.includeSeed) q = q.eq('is_seed', false);
		const { data } = await q;
		ids = (data ?? []).map((r: any) => r.id);
	}
	const results: Array<{ userId: string; ok: boolean; authentic?: boolean; scenes?: number }> = [];
	let analysed = 0, skipped = 0, failed = 0;
	for (const id of ids ?? []) {
		const sig = await capturePhotoSignals(id, { force: opts.force, skipRebuild: true });
		if (sig) {
			analysed++;
			results.push({ userId: id, ok: true, authentic: sig.authenticity.realNotAi && sig.authenticity.identityConsistent, scenes: sig.scenes.length });
			// Propagate for this user (bounded — this task is admin-triggered).
			try {
				const { buildAndStoreUserVectors } = await import('./vector-builder');
				await buildAndStoreUserVectors(id);
			} catch { /* non-fatal */ }
			try {
				const { recomputeAndNormalize } = await import('./trust-normalize');
				await recomputeAndNormalize(id);
			} catch { /* non-fatal */ }
		} else {
			skipped++;
			results.push({ userId: id, ok: false });
		}
	}
	return { analysed, skipped, failed, results };
}
