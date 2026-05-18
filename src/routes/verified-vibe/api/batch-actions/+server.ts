import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';

/**
 * POST /api/verified-vibe/batch-actions
 *
 * Perform multiple like/pass actions in a single request. Useful for bulk operations
 * and improving performance when processing multiple profiles.
 *
 * Request body:
 * {
 *   userId: string (current user ID),
 *   actions: Array<{
 *     type: 'like' | 'pass',
 *     profileId: string
 *   }>
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   processed: number,
 *   failed: number,
 *   results: Array<{
 *     profileId: string,
 *     type: 'like' | 'pass',
 *     success: boolean,
 *     error?: string,
 *     matched?: boolean,
 *     matchId?: string
 *   }>
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json() as {
      userId: string;
      actions: Array<{ type: 'like' | 'pass'; profileId: string }>;
    };

    const { userId, actions } = body;

    // Validate required fields
    if (!userId) {
      return json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    if (!Array.isArray(actions) || actions.length === 0) {
      return json(
        { error: 'Missing or empty actions array' },
        { status: 400 }
      );
    }

    // Limit batch size to prevent abuse
    if (actions.length > 100) {
      return json(
        { error: 'Batch size exceeds maximum (100)' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const results: Array<{
      profileId: string;
      type: 'like' | 'pass';
      success: boolean;
      error?: string;
      matched?: boolean;
      matchId?: string;
    }> = [];

    let processed = 0;
    let failed = 0;

    // Process each action
    for (const action of actions) {
      const { type, profileId } = action;

      // Validate action
      if (!type || !profileId) {
        results.push({
          profileId: profileId || 'unknown',
          type: type || 'like',
          success: false,
          error: 'Missing type or profileId'
        });
        failed++;
        continue;
      }

      // Prevent self-actions
      if (userId === profileId) {
        results.push({
          profileId,
          type,
          success: false,
          error: `Cannot ${type} your own profile`
        });
        failed++;
        continue;
      }

      try {
        if (type === 'like') {
          // Check if like already exists
          const { data: existingLike } = await supabase
            .from('verified_vibe_likes')
            .select('id')
            .eq('user_id', userId)
            .eq('liked_user_id', profileId)
            .single();

          if (existingLike) {
            results.push({
              profileId,
              type,
              success: false,
              error: 'Already liked'
            });
            failed++;
            continue;
          }

          // Save the like
          const { error: likeError } = await supabase
            .from('verified_vibe_likes')
            .insert({
              user_id: userId,
              liked_user_id: profileId
            });

          if (likeError) {
            results.push({
              profileId,
              type,
              success: false,
              error: 'Failed to save like'
            });
            failed++;
            continue;
          }

          // Check for mutual match
          const { data: mutualLike } = await supabase
            .from('verified_vibe_likes')
            .select('id')
            .eq('user_id', profileId)
            .eq('liked_user_id', userId)
            .single();

          if (mutualLike) {
            // Check if match already exists
            const { data: existingMatch } = await supabase
              .from('verified_vibe_matches')
              .select('id')
              .or(
                `and(user1_id.eq.${userId},user2_id.eq.${profileId}),and(user1_id.eq.${profileId},user2_id.eq.${userId})`
              )
              .single();

            if (!existingMatch) {
              // Create new match
              const { data: newMatch } = await supabase
                .from('verified_vibe_matches')
                .insert({
                  user1_id: userId,
                  user2_id: profileId,
                  status: 'mutual'
                })
                .select('id')
                .single();

              results.push({
                profileId,
                type,
                success: true,
                matched: true,
                matchId: newMatch?.id
              });
            } else {
              results.push({
                profileId,
                type,
                success: true,
                matched: true,
                matchId: existingMatch.id
              });
            }
          } else {
            results.push({
              profileId,
              type,
              success: true,
              matched: false
            });
          }

          processed++;
        } else if (type === 'pass') {
          // Check if pass already exists
          const { data: existingPass } = await supabase
            .from('verified_vibe_passes')
            .select('id')
            .eq('user_id', userId)
            .eq('passed_user_id', profileId)
            .single();

          if (existingPass) {
            results.push({
              profileId,
              type,
              success: false,
              error: 'Already passed'
            });
            failed++;
            continue;
          }

          // Save the pass
          const { error: passError } = await supabase
            .from('verified_vibe_passes')
            .insert({
              user_id: userId,
              passed_user_id: profileId
            });

          if (passError) {
            results.push({
              profileId,
              type,
              success: false,
              error: 'Failed to save pass'
            });
            failed++;
            continue;
          }

          results.push({
            profileId,
            type,
            success: true
          });

          processed++;
        }
      } catch (err) {
        results.push({
          profileId,
          type,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
        failed++;
      }
    }

    return json(
      {
        success: failed === 0,
        processed,
        failed,
        results
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Batch actions error:', error);
    return json(
      { error: 'Failed to process batch actions' },
      { status: 500 }
    );
  }
};

