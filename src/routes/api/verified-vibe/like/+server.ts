import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { waitUntil } from '@vercel/functions';
import { getSupabase } from '$lib/server/supabase';
import type { LikeRequest, LikeResponse } from '$lib/verified-vibe/types';
import { logAppError } from '$lib/server/logAppError';

/**
 * POST /api/verified-vibe/like
 *
 * Handles like action on a profile. Checks for mutual match and creates match record if mutual.
 * If not mutual, stores the like for future matching.
 *
 * Request body:
 * {
 *   profileId: string,
 *   userId: string (current user ID)
 * }
 *
 * Response:
 * {
 *   matched: boolean,
 *   matchId?: string (if matched)
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json() as LikeRequest & { userId: string };

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

    // Prevent self-likes
    if (userId === profileId) {
      return json(
        { error: 'Cannot like your own profile' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // 1. Check if like already exists
    const { data: existingLike, error: checkError } = await supabase
      .from('verified_vibe_likes')
      .select('id')
      .eq('user_id', userId)
      .eq('liked_user_id', profileId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is expected
      console.error('Error checking existing like:', checkError);
      return json(
        { error: 'Failed to check like status' },
        { status: 500 }
      );
    }

    if (existingLike) {
      // Like already exists
      return json(
        { error: 'You have already liked this profile' },
        { status: 409 }
      );
    }

    // 2. Save the like
    const { error: likeError } = await supabase
      .from('verified_vibe_likes')
      .insert({
        user_id: userId,
        liked_user_id: profileId
      });

    if (likeError) {
      console.error('Error saving like:', likeError);
      return json(
        { error: 'Failed to save like' },
        { status: 500 }
      );
    }

    // 2a. Record action in history for undo functionality
    try {
      await supabase.from('verified_vibe_action_history').insert({
        user_id: userId,
        action_type: 'like',
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
        event_type: 'like',
        profile_id: profileId,
        metadata: {},
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error recording analytics:', err);
    }

    // 3. Check if mutual match (does the other user like this user?)
    const { data: mutualLike, error: mutualError } = await supabase
      .from('verified_vibe_likes')
      .select('id')
      .eq('user_id', profileId)
      .eq('liked_user_id', userId)
      .single();

    if (mutualError && mutualError.code !== 'PGRST116') {
      console.error('Error checking mutual like:', mutualError);
      return json(
        { error: 'Failed to check mutual match' },
        { status: 500 }
      );
    }

    // 4. If mutual match, create match record
    if (mutualLike) {
      // Check if match already exists (check both directions)
      const { data: existingMatch1, error: matchCheckError1 } = await supabase
        .from('verified_vibe_matches')
        .select('id')
        .eq('user1_id', userId)
        .eq('user2_id', profileId)
        .single();

      const { data: existingMatch2, error: matchCheckError2 } = await supabase
        .from('verified_vibe_matches')
        .select('id')
        .eq('user1_id', profileId)
        .eq('user2_id', userId)
        .single();

      // Check for actual errors (not "no rows found")
      if (
        (matchCheckError1 && matchCheckError1.code !== 'PGRST116') ||
        (matchCheckError2 && matchCheckError2.code !== 'PGRST116')
      ) {
        console.error('Error checking existing match:', matchCheckError1 || matchCheckError2);
        return json(
          { error: 'Failed to check match status' },
          { status: 500 }
        );
      }

      const existingMatch = existingMatch1 || existingMatch2;

      if (!existingMatch) {
        // Create new match record. Bestie is default-on for every new match
        // (per spec) so it can proactively open the conversation.
        const { data: newMatch, error: createMatchError } = await supabase
          .from('verified_vibe_matches')
          .insert({
            user1_id: userId,
            user2_id: profileId,
            status: 'mutual',
            ai_bestie_active: true
          })
          .select('id')
          .single();

        if (createMatchError) {
          console.error('Error creating match:', createMatchError);
          return json(
            { error: 'Failed to create match' },
            { status: 500 }
          );
        }

        // Bestie speaks first: proactively open the thread on the woman's behalf.
        // Fire-and-forget so the like response returns immediately; the helper is
        // idempotent + non-fatal and no-ops if neither side is a woman.
        const newMatchId = newMatch.id;
        waitUntil((async () => {
          try {
            const { generateAndSendBestieOpener } = await import('$lib/server/bestie-responder');
            await generateAndSendBestieOpener(newMatchId);
          } catch (e) {
            console.error('Bestie opener failed (non-fatal):', e);
          }
        })());

        const response: LikeResponse = {
          matched: true,
          matchId: newMatch.id
        };

        return json(response, { status: 201 });
      } else {
        // Match already exists
        const response: LikeResponse = {
          matched: true,
          matchId: existingMatch.id
        };

        return json(response, { status: 201 });
      }
    }

    // 5. No mutual match yet, just return success
    const response: LikeResponse = {
      matched: false
    };

    return json(response, { status: 201 });
  } catch (error) {
    console.error('Like error:', error);
    logAppError(error, {
      feature: 'Discovery — Like',
      file: 'src/routes/api/verified-vibe/like/+server.ts',
      endpoint: 'POST /api/verified-vibe/like',
      userId,
    }).catch(() => {});
    return json(
      { error: 'Failed to process like' },
      { status: 500 }
    );
  }
};

/**
 * DELETE /api/verified-vibe/like
 *
 * Removes a like from a profile.
 *
 * Request body:
 * {
 *   profileId: string,
 *   userId: string (current user ID)
 * }
 */
export const DELETE: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json() as { profileId: string; userId: string };

    const { profileId, userId } = body;

    // Validate required fields
    if (!profileId || !userId) {
      return json(
        { error: 'Missing profileId or userId' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Delete the like
    const { error: deleteError } = await supabase
      .from('verified_vibe_likes')
      .delete()
      .eq('user_id', userId)
      .eq('liked_user_id', profileId);

    if (deleteError) {
      console.error('Error deleting like:', deleteError);
      return json(
        { error: 'Failed to delete like' },
        { status: 500 }
      );
    }

    return json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Delete like error:', error);
    return json(
      { error: 'Failed to delete like' },
      { status: 500 }
    );
  }
};
