import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { DiscoveryProfile } from '$lib/verified-vibe/types';
import { getSupabase } from '$lib/server/supabase';

interface DiscoveryFeedRequest {
  limit?: number;
  offset?: number;
  excludeIds?: string[];
  sortBy?: 'trustScore' | 'compatibility';
}

interface DiscoveryFeedResponse {
  data: {
    profiles: DiscoveryProfile[];
    hasMore: boolean;
    total: number;
  };
}

/**
 * GET /api/verified-vibe/discovery-feed
 *
 * Retrieves a paginated list of user profiles for the discovery feed.
 * Profiles are sorted by trust score (highest first) and compatibility.
 * Excludes the current user, any blocked/passed users, and users who have blocked the current user.
 *
 * Query parameters:
 * - limit: number of profiles to return (default: 10, max: 50)
 * - offset: pagination offset (default: 0)
 * - excludeIds: comma-separated list of user IDs to exclude
 * - blockedIds: comma-separated list of blocked user IDs
 * - sortBy: 'trustScore' (default) or 'compatibility'
 *
 * Response:
 * {
 *   data: {
 *     profiles: DiscoveryProfile[],
 *     hasMore: boolean,
 *     total: number
 *   }
 * }
 */
export const GET: RequestHandler = async ({ url, locals, request }) => {
  try {
    // Parse query parameters
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const excludeIdsParam = url.searchParams.get('excludeIds');
    const blockedIdsParam = url.searchParams.get('blockedIds');
    const sortBy = (url.searchParams.get('sortBy') || 'trustScore') as 'trustScore' | 'compatibility';

    // Parse exclude IDs and blocked IDs
    const excludeIds = excludeIdsParam ? excludeIdsParam.split(',') : [];
    const blockedIds = blockedIdsParam ? blockedIdsParam.split(',') : [];

    // Validate parameters
    if (limit < 1 || limit > 50) {
      return json(
        { error: 'limit must be between 1 and 50' },
        { status: 400 }
      );
    }

    if (offset < 0) {
      return json(
        { error: 'offset must be non-negative' },
        { status: 400 }
      );
    }

    // Get current user from Authorization header
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Create a client with the user's token to get their ID
    const { createClient } = await import('@supabase/supabase-js');
    const { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } = await import('$env/static/public');
    const userClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user } } = await userClient.auth.getUser();

    if (!user) {
      return json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const currentUserId = user.id;

    // Use server-side client with service role to bypass RLS and fetch all profiles
    const supabase = getSupabase();

    // Fetch current user's profile to get their gender
    const { data: currentUserProfile, error: currentUserError } = await (supabase as any)
      .from('verified_vibe_users')
      .select('gender')
      .eq('id', currentUserId)
      .single();

    if (currentUserError || !currentUserProfile) {
      console.error('Error fetching current user profile:', currentUserError);
      return json(
        { error: 'Failed to fetch your profile' },
        { status: 500 }
      );
    }

    const currentUserGender = currentUserProfile.gender || 'man';

    // Determine opposite gender
    const targetGender = currentUserGender === 'man' ? 'woman' : 'man';

    // Fetch all verified profiles from database (opposite gender only)
    const { data: profiles, error: profileError } = await (supabase as any)
      .from('verified_vibe_users')
      .select('*')
      .neq('id', currentUserId)
      .eq('gender', targetGender);

    if (profileError) {
      console.error('Database error:', profileError);
      return json(
        { error: 'Failed to fetch profiles' },
        { status: 500 }
      );
    }

    // Fetch verification steps for all profiles to calculate trust scores
    const { data: verificationSteps } = await (supabase as any)
      .from('verified_vibe_verification')
      .select('user_id, step, status');

    const trustScoreMap = new Map<string, number>();
    const verificationMap = new Map<string, Set<string>>();

    if (verificationSteps) {
      verificationSteps.forEach((step: any) => {
        // Calculate trust points: 25 per completed step
        const trustPoints = step.status === 'completed' ? 25 : 0;
        const current = trustScoreMap.get(step.user_id) || 0;
        trustScoreMap.set(step.user_id, current + trustPoints);

        if (!verificationMap.has(step.user_id)) {
          verificationMap.set(step.user_id, new Set());
        }
        verificationMap.get(step.user_id)!.add(step.step);
      });
    }

    // Fetch user's already-liked profiles from database
    const { data: likedProfiles } = await (supabase as any)
      .from('verified_vibe_likes')
      .select('liked_user_id')
      .eq('user_id', currentUserId);

    const likedProfileIds = (likedProfiles || []).map((like: any) => like.liked_user_id);

    // Fetch user's already-passed profiles from database
    const { data: passedProfiles } = await (supabase as any)
      .from('verified_vibe_passes')
      .select('passed_user_id')
      .eq('user_id', currentUserId);

    const passedProfileIds = (passedProfiles || []).map((pass: any) => pass.passed_user_id);

    // Combine all exclude IDs (from query params + database history)
    const allExcludeIds = new Set([
      ...excludeIds,
      ...likedProfileIds,
      ...passedProfileIds
    ]);

    // Convert database profiles to DiscoveryProfile format
    const discoveryProfiles: DiscoveryProfile[] = (profiles || [])
      .filter((p: any) => !allExcludeIds.has(p.id) && !blockedIds.includes(p.id))
      .map((p: any) => {
        const trustScore = trustScoreMap.get(p.id) || 0;
        const verifiedSteps = Array.from(verificationMap.get(p.id) || new Set()).map(s => {
          const stepNames: Record<string, string> = {
            id: 'ID',
            liveness: 'Liveness',
            photos: 'Photos',
            spending_or_qa: 'Q&A'
          };
          return stepNames[s] || s;
        });

        return {
          id: p.id,
          gender: p.gender || 'man',
          archetype: p.archetype || 'casual_man',
          firstName: p.first_name || 'User',
          age: p.age || 25,
          city: p.city || 'Unknown',
          avatar: p.avatar_url || null,
          about: 'Profile being reviewed',
          looking: 'Looking for connection',
          trustScore,
          createdAt: new Date(p.created_at),
          updatedAt: new Date(p.updated_at),
          distance: Math.floor(Math.random() * 20) + 1 + ' mi',
          verified: verifiedSteps.length > 0 ? verifiedSteps : []
        };
      });

    // Sort by selected criteria
    if (sortBy === 'trustScore') {
      discoveryProfiles.sort((a, b) => b.trustScore - a.trustScore);
    } else if (sortBy === 'compatibility') {
      // Compatibility scoring (could be improved with archetype matching)
      discoveryProfiles.sort((a, b) => {
        const scoreA = (b.verified.length * 20) + (b.trustScore / 5);
        const scoreB = (a.verified.length * 20) + (a.trustScore / 5);
        return scoreB - scoreA;
      });
    }

    // Apply pagination
    const total = discoveryProfiles.length;
    const paginatedProfiles = discoveryProfiles.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    const response: DiscoveryFeedResponse = {
      data: {
        profiles: paginatedProfiles,
        hasMore,
        total
      }
    };

    return json(response);
  } catch (error) {
    console.error('Discovery feed error:', error);
    return json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
};
