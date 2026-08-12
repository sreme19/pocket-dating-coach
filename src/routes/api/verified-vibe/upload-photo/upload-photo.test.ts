/**
 * Regression tests for the "photos step backstop" added in d7a49a3b.
 *
 * Why this is worth testing rather than eyeballing: Discover and the matchmaker
 * pool both gate on "does a `photos` verification row exist?", never on "does
 * this profile have photos?". Only the onboarding flow used to write that row,
 * so a user who added or replaced a photo from the profile screen instead ended
 * up with real, screened, published photos and no row — complete profile,
 * verified selfie, invisible to every other member. Three live users were found
 * in that state (see handoff, root cause B).
 *
 * The fix has to stay narrow on purpose:
 *   - only the screened `dataUrl` upload path creates the row (an already-hosted
 *     `imageUrl` — e.g. an AI portrait — was derived from a raw photo that came
 *     through here first, so it must not double-count),
 *   - it must never overwrite an existing row (onboarding's record is richer),
 *   - a rejected photo must never reach the backstop at all.
 * Each of those is its own test below, because each is a distinct way the fix
 * could silently regress.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { getSupabase } = vi.hoisted(() => ({ getSupabase: vi.fn() }));
vi.mock('$lib/server/supabase', () => ({ getSupabase }));

const { captureUploads } = vi.hoisted(() => ({ captureUploads: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/server/upload-audit', () => ({ captureUploads }));

const { screenProfilePhotos, gateRecord } = vi.hoisted(() => ({
	screenProfilePhotos: vi.fn(),
	gateRecord: vi.fn(() => ({ status: 'unverified', checkedAt: 'now' }))
}));
vi.mock('$lib/server/photo-identity-gate', () => ({ screenProfilePhotos, gateRecord }));

const { recomputeAndNormalize } = vi.hoisted(() => ({
	recomputeAndNormalize: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('$lib/server/trust-normalize', () => ({ recomputeAndNormalize }));

const { enrollInPoolIfVerified } = vi.hoisted(() => ({
	enrollInPoolIfVerified: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('$lib/server/pool-registry', () => ({ enrollInPoolIfVerified }));

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({
	createClient: vi.fn(() => ({ auth: { getUser } }))
}));
vi.mock('$env/static/public', () => ({
	PUBLIC_SUPABASE_URL: 'http://localhost',
	PUBLIC_SUPABASE_ANON_KEY: 'anon-key'
}));

import { POST } from './+server';

const USER_ID = 'user-under-test';

/** A 1x1 PNG data URL — bytes are never inspected, only base64-decoded. */
const DATA_URL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

/**
 * Builds a `getSupabase()` stand-in with just enough surface for this route:
 * a `gender` lookup, the two `verified_vibe_verification` lookups (stale-
 * rejected clearing, and the new existing-row check), an `insert` spy, an
 * `update` spy, and storage upload/getPublicUrl. Routes on table name, and on
 * the `select()` column list for the two different lookups on the same table.
 */
function buildSupabase(opts: {
	gender?: string;
	existingPhotosRow?: { id: string } | null;
	staleRejectedRow?: { id: string; data: Record<string, unknown> } | null;
} = {}) {
	const { gender = 'woman', existingPhotosRow = null, staleRejectedRow = null } = opts;

	const insertSpy = vi.fn().mockResolvedValue({ data: null, error: null });
	const updateEqSpy = vi.fn().mockResolvedValue({ data: null, error: null });
	const updateSpy = vi.fn(() => ({ eq: updateEqSpy }));
	const stepUpdateEqSpy = vi.fn().mockResolvedValue({ data: null, error: null });
	const stepUpdateSpy = vi.fn(() => ({ eq: stepUpdateEqSpy }));

	const from = vi.fn((table: string) => {
		if (table === 'verified_vibe_users') {
			return {
				select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { gender } }) }) }),
				update: updateSpy
			};
		}
		if (table === 'verified_vibe_verification') {
			return {
				// Both lookups are select(...).eq('user_id', id).eq('step', 'photos').maybeSingle().
				// Distinguish by the requested columns, exactly as the real queries differ.
				select: (cols: string) => ({
					eq: () => ({
						eq: () => ({
							maybeSingle: async () =>
								cols.includes('data')
									? { data: staleRejectedRow }
									: { data: existingPhotosRow }
						})
					})
				}),
				insert: insertSpy,
				update: stepUpdateSpy
			};
		}
		throw new Error(`unexpected table in test: ${table}`);
	});

	const upload = vi.fn().mockResolvedValue({ error: null });
	const getPublicUrl = vi.fn(() => ({ data: { publicUrl: 'https://cdn.example.com/p.jpg' } }));
	const storage = { from: vi.fn(() => ({ upload, getPublicUrl })) };

	return { from, storage, insertSpy, updateSpy, updateEqSpy, upload };
}

function req(body: unknown, { auth = 'Bearer valid-token' }: { auth?: string | null } = {}) {
	const headers: Record<string, string> = { 'content-type': 'application/json' };
	if (auth) headers.authorization = auth;
	return new Request('http://localhost/api/verified-vibe/upload-photo', {
		method: 'POST',
		headers,
		body: JSON.stringify(body)
	});
}

function call(request: Request) {
	return (POST as unknown as (e: { request: Request }) => Promise<Response>)({ request });
}

beforeEach(() => {
	vi.clearAllMocks();
	getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
	gateRecord.mockReturnValue({ status: 'unverified', checkedAt: 'now' });
});

describe('POST /upload-photo — auth', () => {
	it('refuses with 401 when there is no Authorization header', async () => {
		getSupabase.mockReturnValue(buildSupabase());
		const res = await call(req({ dataUrl: DATA_URL, label: 'photo1' }, { auth: null }));
		expect(res.status).toBe(401);
	});

	it('refuses with 401 when the token does not resolve to a user', async () => {
		getSupabase.mockReturnValue(buildSupabase());
		getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad token' } });
		const res = await call(req({ dataUrl: DATA_URL, label: 'photo1' }));
		expect(res.status).toBe(401);
	});
});

describe('POST /upload-photo — the photos-step backstop (root cause B)', () => {
	it('creates a `photos` verification row on a passed screen when none exists yet', async () => {
		const sb = buildSupabase({ existingPhotosRow: null });
		getSupabase.mockReturnValue(sb);
		screenProfilePhotos.mockResolvedValue({ status: 'passed', rejected: [], message: '' });

		const res = await call(req({ dataUrl: DATA_URL, label: 'photo1' }));

		expect(res.status).toBe(200);
		expect(sb.insertSpy).toHaveBeenCalledTimes(1);
		const inserted = sb.insertSpy.mock.calls[0][0];
		expect(inserted).toMatchObject({
			user_id: USER_ID,
			step: 'photos',
			status: 'completed',
			data: expect.objectContaining({ source: 'profile-photo-upload' })
		});
		expect(recomputeAndNormalize).toHaveBeenCalledWith(USER_ID);
		expect(enrollInPoolIfVerified).toHaveBeenCalledWith(USER_ID);
	});

	it('still creates the row on an "unverified" (no-anchor) screen — it is not made poolable on its own', async () => {
		const sb = buildSupabase({ existingPhotosRow: null });
		getSupabase.mockReturnValue(sb);
		screenProfilePhotos.mockResolvedValue({ status: 'unverified', rejected: [], message: '' });

		const res = await call(req({ dataUrl: DATA_URL, label: 'photo1' }));

		expect(res.status).toBe(200);
		expect(sb.insertSpy).toHaveBeenCalledTimes(1);
	});

	it('never overwrites an existing `photos` row — onboarding already wrote a richer one', async () => {
		const sb = buildSupabase({ existingPhotosRow: { id: 'existing-row' } });
		getSupabase.mockReturnValue(sb);
		screenProfilePhotos.mockResolvedValue({ status: 'passed', rejected: [], message: '' });

		const res = await call(req({ dataUrl: DATA_URL, label: 'photo1' }));

		expect(res.status).toBe(200);
		expect(sb.insertSpy).not.toHaveBeenCalled();
	});

	it('never runs the backstop for a rejected photo — nothing was actually published', async () => {
		const sb = buildSupabase({ existingPhotosRow: null });
		getSupabase.mockReturnValue(sb);
		screenProfilePhotos.mockResolvedValue({
			status: 'rejected',
			rejected: [{ index: 0, reason: 'Face does not match your verification selfie.' }],
			message: 'None of these photos match your verification selfie.'
		});

		const res = await call(req({ dataUrl: DATA_URL, label: 'photo1' }));

		expect(res.status).toBe(422);
		const body = await res.json();
		expect(body.code).toBe('photo_identity_mismatch');
		expect(sb.insertSpy).not.toHaveBeenCalled();
		expect(sb.upload).not.toHaveBeenCalled(); // rejected before the bytes reach Storage
	});

	it('never runs the backstop for an already-hosted imageUrl — it was screened once already, upstream', async () => {
		const sb = buildSupabase({ existingPhotosRow: null });
		getSupabase.mockReturnValue(sb);

		const res = await call(req({ imageUrl: 'https://cdn.example.com/ai-portrait.jpg', label: 'lead' }));

		expect(res.status).toBe(200);
		expect(screenProfilePhotos).not.toHaveBeenCalled();
		expect(sb.insertSpy).not.toHaveBeenCalled();
	});
});

describe('POST /upload-photo — avatar mirror', () => {
	it('mirrors the lead photo to avatar_url for a woman', async () => {
		const sb = buildSupabase({ gender: 'woman', existingPhotosRow: { id: 'x' } });
		getSupabase.mockReturnValue(sb);
		screenProfilePhotos.mockResolvedValue({ status: 'passed', rejected: [], message: '' });

		await call(req({ dataUrl: DATA_URL, label: 'lead' }));

		expect(sb.updateSpy).toHaveBeenCalledWith(expect.objectContaining({ avatar_url: expect.any(String) }));
	});

	it('never mirrors a man\'s raw upload to avatar_url — his avatar is the AI lead portrait only', async () => {
		const sb = buildSupabase({ gender: 'man', existingPhotosRow: { id: 'x' } });
		getSupabase.mockReturnValue(sb);
		screenProfilePhotos.mockResolvedValue({ status: 'passed', rejected: [], message: '' });

		await call(req({ dataUrl: DATA_URL, label: 'lead' }));

		expect(sb.updateSpy).not.toHaveBeenCalled();
	});
});
