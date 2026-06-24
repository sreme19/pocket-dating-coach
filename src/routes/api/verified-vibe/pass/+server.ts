import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getSupabase } from '$lib/server/supabase';
import { logAppError } from '$lib/server/logAppError';

/**
 * POST /api/verified-vibe/pass
 *
 * Handles pass action on a profile. Stores the pass to prevent showing the profile again.
 *
 * Request body:
 * {
 *   profileId: string,
 *   userId: string (current user ID)
 * }
 *
 * Response:
 * {
 *   success: boolean
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json() as { profileId: string; userId: string };

    const { profileId, userId } = body;

    // Validate required fields
    if (!profileId) {
      return json(
        { error: 'Missing profileId' },
        { status: 400 }
      );
    }

    if (!userId) {
      return json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    // Prevent self-passes
    if (userId === profileId) {
      return json(
        { error: 'Cannot pass your own profile' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // 1. Check if pass already exists
    const { data: existingPass, error: checkError } = await supabase
      .from('verified_vibe_passes')
      .select('id')
      .eq('user_id', userId)
      .eq('passed_user_id', profileId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is expected
      console.error('Error checking existing pass:', checkError);
      return json(
        { error: 'Failed to check pass status' },
        { status: 500 }
      );
    }

    if (existingPass) {
      // Pass already exists
      return json(
        { error: 'You have already passed this profile' },
        { status: 409 }
      );
    }

    // 2. Save the pass
    const { error: passError } = await supabase
      .from('verified_vibe_passes')
      .insert({
        user_id: userId,
        passed_user_id: profileId
      });

    if (passError) {
      console.error('Error saving pass:', passError);
      return json(
        { error: 'Failed to save pass' },
        { status: 500 }
      );
    }

    // 2a. Record action in history for undo functionality
    try {
      await supabase.from('verified_vibe_action_history').insert({
        user_id: userId,
        action_type: 'pass',
        profile_id: profileId,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error recording action history:', err);
    }

    // 2b. Track analytics event
    try {
      await supabase.from('verified_vibe_analytics').insert({
        user_id: userId,
        event_type: 'pass',
        profile_id: profileId,
        metadata: {},
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error recording analytics:', err);
    }

    return json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Pass error:', error);
    logAppError(error, {
      feature: 'Discovery — Pass',
      file: 'src/routes/api/verified-vibe/pass/+server.ts',
      endpoint: 'POST /api/verified-vibe/pass',
      userId,
    }).catch(() => {});
    return json(
      { error: 'Failed to process pass' },
      { status: 500 }
    );
  }
};
