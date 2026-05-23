/**
 * POST /api/verified-vibe/tips
 * Submit an anonymous tip for a profile viewed in discover.
 * The submitter's identity is never stored — only their gender.
 *
 * Body:
 *   targetUserId   string    — whose profile is being tipped
 *   submitterGender string   — 'man' | 'woman' | 'prefer_not_to_say'
 *   tags           string[]  — selected tag bubbles
 *   text?          string    — optional freetext (max 280 chars)
 *
 * GET /api/verified-vibe/tips?targetUserId=xxx
 * Returns aggregated tag counts for AI context. Never returns individual submissions.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';

const VALID_TAGS_BY_GENDER: Record<string, string[]> = {
  woman: [
    'handsome', 'not-my-type', 'successful-vibes', 'trustworthy',
    'charming', 'red-flag-energy', 'great-photos', 'improve-photos',
    'well-spoken', 'mysterious'
  ],
  man: [
    'stunning', 'elegant', 'intimidating', 'approachable',
    'warm', 'guarded', 'great-photos', 'improve-photos',
    'interesting-vibe', 'authentic'
  ],
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json() as {
      targetUserId?: string;
      submitterGender?: string;
      tags?: string[];
      text?: string;
    };

    const targetUserId = body.targetUserId?.trim();
    const submitterGender = body.submitterGender?.trim();
    const tags = Array.isArray(body.tags) ? body.tags.slice(0, 10) : [];
    const text = (body.text ?? '').trim().slice(0, 280);

    if (!targetUserId) return json({ error: 'Missing targetUserId' }, { status: 400 });
    if (!submitterGender || !['man', 'woman', 'prefer_not_to_say'].includes(submitterGender)) {
      return json({ error: 'Invalid submitterGender' }, { status: 400 });
    }
    if (tags.length === 0 && !text) {
      return json({ error: 'Provide at least one tag or a text tip' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await (supabase as any).from('profile_tips').insert({
      target_user_id: targetUserId,
      submitted_by_gender: submitterGender,
      tip_tags: tags,
      tip_text: text || null,
    });

    if (error) {
      console.error('[Tips] DB insert error:', error);
      return json({ error: 'Failed to save tip' }, { status: 500 });
    }

    return json({ ok: true });
  } catch (err) {
    console.error('[Tips] POST error:', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};

export const GET: RequestHandler = async ({ url }) => {
  try {
    const targetUserId = url.searchParams.get('targetUserId')?.trim();
    if (!targetUserId) return json({ error: 'Missing targetUserId' }, { status: 400 });

    const supabase = getSupabase();
    const { data, error } = await (supabase as any)
      .from('profile_tips')
      .select('tip_tags, tip_text, submitted_by_gender')
      .eq('target_user_id', targetUserId);

    if (error) return json({ error: 'Failed to fetch tips' }, { status: 500 });

    // Aggregate tag counts — never expose individual submissions
    const tagCounts: Record<string, number> = {};
    const textSamples: string[] = [];

    for (const row of data ?? []) {
      for (const tag of row.tip_tags ?? []) {
        tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
      }
      if (row.tip_text) textSamples.push(row.tip_text);
    }

    return json({
      totalTips: data?.length ?? 0,
      tagCounts,
      // Return text samples only for AI use — not attributed to anyone
      textSamples: textSamples.slice(0, 5),
    });
  } catch (err) {
    console.error('[Tips] GET error:', err);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};

export { VALID_TAGS_BY_GENDER };
