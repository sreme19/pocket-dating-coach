import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';

/**
 * POST /api/verified-vibe/undo
 *
 * Undo the last like or pass action. Maintains a history of recent actions
 * to allow users to undo their decisions.
 *
 * Request body:
 * {
 *   userId: string (current user ID)
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   action?: 'like' | 'pass',
 *   profileId?: string,
 *   message?: string
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json() as { userId: string };
    const { userId } = body;

    // Validate required fields
    if (!userId) {
      return json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // 1. Get the most recent action from action history
    const { data: recentAction, error: historyError } = await supabase
      .from('verified_vibe_action_history')
      .select('id, action_type, profile_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (historyError && historyError.code !== 'PGRST116') {
      console.error('Error fetching action history:', historyError);
      return json(
        { error: 'Failed to fetch action history' },
        { status: 500 }
      );
    }

    if (!recentAction) {
      return json(
        { error: 'No recent actions to undo' },
        { status: 404 }
      );
    }

    // 2. Check if action is too old (> 1 hour)
    const actionTime = new Date(recentAction.created_at).getTime();
    const currentTime = Date.now();
    const timeDiffMinutes = (currentTime - actionTime) / (1000 * 60);

    if (timeDiffMinutes > 60) {
      return json(
        { error: 'Action is too old to undo (max 1 hour)' },
        { status: 400 }
      );
    }

    // 3. Undo the action based on type
    if (recentAction.action_type === 'like') {
      // Delete the like
      const { error: deleteError } = await supabase
        .from('verified_vibe_likes')
        .delete()
        .eq('user_id', userId)
        .eq('liked_user_id', recentAction.profile_id);

      if (deleteError) {
        console.error('Error deleting like:', deleteError);
        return json(
          { error: 'Failed to undo like' },
          { status: 500 }
        );
      }

      // Delete from action history
      await supabase
        .from('verified_vibe_action_history')
        .delete()
        .eq('id', recentAction.id);

      return json(
        {
          success: true,
          action: 'like',
          profileId: recentAction.profile_id,
          message: 'Like undone'
        },
        { status: 200 }
      );
    } else if (recentAction.action_type === 'pass') {
      // Delete the pass
      const { error: deleteError } = await supabase
        .from('verified_vibe_passes')
        .delete()
        .eq('user_id', userId)
        .eq('passed_user_id', recentAction.profile_id);

      if (deleteError) {
        console.error('Error deleting pass:', deleteError);
        return json(
          { error: 'Failed to undo pass' },
          { status: 500 }
        );
      }

      // Delete from action history
      await supabase
        .from('verified_vibe_action_history')
        .delete()
        .eq('id', recentAction.id);

      return json(
        {
          success: true,
          action: 'pass',
          profileId: recentAction.profile_id,
          message: 'Pass undone'
        },
        { status: 200 }
      );
    }

    return json(
      { error: 'Unknown action type' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Undo error:', error);
    return json(
      { error: 'Failed to process undo' },
      { status: 500 }
    );
  }
};

