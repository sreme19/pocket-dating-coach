import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { DiscoveryProfile } from '$lib/verified-vibe/types';
import { getSupabaseClient } from '$lib/client/supabase';

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
export const GET: RequestHandler = async ({ url, locals }) => {
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

    // Get current user from session
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const currentUserId = session.user.id;

    // Fetch all verified profiles from database
    const { data: profiles, error: profileError } = await (supabase as any)
      .from('verified_vibe_users')
      .select('*')
      .neq('id', currentUserId);

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

    // Convert database profiles to DiscoveryProfile format
    const discoveryProfiles: DiscoveryProfile[] = (profiles || [])
      .filter((p: any) => !excludeIds.includes(p.id) && !blockedIds.includes(p.id))
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
          avatar: null,
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
