/**
 * POST /api/verified-vibe/artifacts
 *
 * Upload a trust-evidence artifact (image/screenshot) for a user.
 * Stores the file in Supabase Storage, writes a record to user_artifacts,
 * and immediately boosts the user's trust score.
 *
 * FormData fields:
 *   file        File     — the image to upload
 *   userId      string   — the uploader's VV user ID
 *   claimTag    string   — what the artifact proves: 'wealthy' | 'well_traveled' | 'fitness' | 'general'
 *   description string?  — optional short label
 *
 * Response:
 *   { url: string; artifactId: string; trustPoints: number; newTrustScore: number }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const BUCKET = 'profiles';

const CLAIM_TRUST_POINTS: Record<string, number> = {
  wealthy:      10,
  well_traveled: 8,
  fitness:       5,
  general:       3,
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    const userId = (form.get('userId') as string | null)?.trim();
    const claimTag = (form.get('claimTag') as string | null)?.trim() || 'general';
    const description = (form.get('description') as string | null)?.trim() || '';

    if (!file) return json({ error: 'Missing file' }, { status: 400 });
    if (!userId) return json({ error: 'Missing userId' }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) {
      return json({ error: 'Unsupported file type' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return json({ error: 'File exceeds 10 MB limit' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Upload to Supabase Storage
    const ext = file.name.split('.').pop() || 'jpg';
    const storagePath = `artifacts/${userId}/${Date.now()}_${claimTag}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error('[Artifacts] Storage upload error:', uploadError);
      return json({ error: 'Upload failed' }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const storageUrl = urlData.publicUrl;
    const trustPoints = CLAIM_TRUST_POINTS[claimTag] ?? 3;

    // Write artifact record
    const { data: artifact, error: dbError } = await (supabase as any)
      .from('user_artifacts')
      .insert({
        user_id: userId,
        storage_url: storageUrl,
        file_name: file.name,
        mime_type: file.type,
        claim_tag: claimTag,
        description: description || null,
        trust_points: trustPoints,
      })
      .select('id')
      .single();

    if (dbError) {
      console.error('[Artifacts] DB insert error:', dbError);
      return json({ error: 'Failed to save artifact record' }, { status: 500 });
    }

    // Immediately boost trust score
    const { data: user } = await supabase
      .from('verified_vibe_users')
      .select('trust_score')
      .eq('id', userId)
      .single();

    const currentScore = user?.trust_score ?? 0;
    const newTrustScore = Math.min(currentScore + trustPoints, 100);

    await supabase
      .from('verified_vibe_users')
      .update({ trust_score: newTrustScore, updated_at: new Date().toISOString() })
      .eq('id', userId);

    return json({
      url: storageUrl,
      artifactId: artifact.id,
      trustPoints,
      newTrustScore,
    });
  } catch (err) {
    console.error('[Artifacts] Unexpected error:', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};

/**
 * GET /api/verified-vibe/artifacts?userId=xxx
 *
 * Returns all artifacts for a user, grouped by claim tag.
 * Used by AI Bestie/Wingman system prompts to avoid re-asking for proof.
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const userId = url.searchParams.get('userId')?.trim();
    if (!userId) return json({ error: 'Missing userId' }, { status: 400 });

    const supabase = getSupabase();
    const { data, error } = await (supabase as any)
      .from('user_artifacts')
      .select('id, claim_tag, description, storage_url, trust_points, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return json({ error: 'Failed to fetch artifacts' }, { status: 500 });

    return json({ artifacts: data ?? [] });
  } catch (err) {
    console.error('[Artifacts] GET error:', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
