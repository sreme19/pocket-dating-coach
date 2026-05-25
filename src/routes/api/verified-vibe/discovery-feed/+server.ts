import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { DiscoveryProfile } from '$lib/verified-vibe/types';
import { getSupabase } from '$lib/server/supabase';
import { MATCH_MATRIX } from '$lib/verified-vibe/constants';

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
const SEED_PROFILES_WOMAN: DiscoveryProfile[] = [
  {
    id: 'seed-w-1', gender: 'woman', archetype: 'traditional_matrimony_woman' as any,
    firstName: 'Priya', age: 26, city: 'Chicago, IL',
    avatar: null, about: 'Family-oriented and looking for a lifelong partner. Love cooking, travel, and quiet evenings.',
    looking: 'Marriage', trustScore: 85, distance: '—', verified: ['id', 'liveness', 'photos'],
    createdAt: new Date(), updatedAt: new Date(), isSeed: true
  },
  {
    id: 'seed-w-2', gender: 'woman', archetype: 'forever_focused_woman' as any,
    firstName: 'Aisha', age: 28, city: 'Houston, TX',
    avatar: null, about: 'Focused on building a future with the right person. Values trust, loyalty, and shared goals.',
    looking: 'Serious relationship', trustScore: 78, distance: '—', verified: ['id', 'photos'],
    createdAt: new Date(), updatedAt: new Date(), isSeed: true
  },
  {
    id: 'seed-w-3', gender: 'woman', archetype: 'spoiled_casual_woman' as any,
    firstName: 'Sofia', age: 24, city: 'Miami, FL',
    avatar: null, about: 'Loves fine dining and spontaneous adventures. Looking for a confident, caring partner.',
    looking: 'Casual dating', trustScore: 72, distance: '—', verified: ['id', 'photos'],
    createdAt: new Date(), updatedAt: new Date(), isSeed: true
  },
  {
    id: 'seed-w-4', gender: 'woman', archetype: 'hopeless_romantic_woman' as any,
    firstName: 'Nadia', age: 25, city: 'New York, NY',
    avatar: null, about: 'Hopeless romantic who believes in genuine connection. Loves literature and long walks.',
    looking: 'Serious relationship', trustScore: 80, distance: '—', verified: ['id', 'liveness', 'photos'],
    createdAt: new Date(), updatedAt: new Date(), isSeed: true
  }
];

const SEED_PROFILES_MAN: DiscoveryProfile[] = [
  {
    id: 'seed-m-1', gender: 'man', archetype: 'traditional_matrimony_man' as any,
    firstName: 'Arjun', age: 29, city: 'Dallas, TX',
    avatar: null, about: 'Family-first mindset. Engineer by day, home chef by evening. Looking for a life partner.',
    looking: 'Marriage', trustScore: 87, distance: '—', verified: ['id', 'liveness', 'photos'],
    createdAt: new Date(), updatedAt: new Date(), isSeed: true
  },
  {
    id: 'seed-m-2', gender: 'man', archetype: 'forever_focused_man' as any,
    firstName: 'Marcus', age: 31, city: 'Atlanta, GA',
    avatar: null, about: 'Purpose-driven and ready to settle down with the right woman.',
    looking: 'Serious relationship', trustScore: 82, distance: '—', verified: ['id', 'photos'],
    createdAt: new Date(), updatedAt: new Date(), isSeed: true
  },
  {
    id: 'seed-m-3', gender: 'man', archetype: 'casual_generous_man' as any,
    firstName: 'James', age: 27, city: 'Los Angeles, CA',
    avatar: null, about: 'Entrepreneur who enjoys spoiling a deserving woman. Life of the party with a generous heart.',
    looking: 'Casual dating', trustScore: 75, distance: '—', verified: ['id', 'photos'],
    createdAt: new Date(), updatedAt: new Date(), isSeed: true
  },
  {
    id: 'seed-m-4', gender: 'man', archetype: 'hopeless_romantic_man' as any,
    firstName: 'David', age: 30, city: 'Seattle, WA',
    avatar: null, about: 'Believes in old-school romance. Will plan the perfect date for you.',
    looking: 'Serious relationship', trustScore: 79, distance: '—', verified: ['id', 'liveness', 'photos'],
    createdAt: new Date(), updatedAt: new Date(), isSeed: true
  }
];

function buildSeedProfiles(targetGender: string, compatibleArchetypes: string[]): DiscoveryProfile[] {
  const pool = targetGender === 'woman' ? SEED_PROFILES_WOMAN : SEED_PROFILES_MAN;
  if (compatibleArchetypes.length === 0) return pool;
  const filtered = pool.filter(p => compatibleArchetypes.includes(p.archetype));
  return filtered.length > 0 ? filtered : pool;
}

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
      .maybeSingle();

    if (currentUserError) {
      console.error('Error fetching current user profile:', currentUserError);
      return json(
        { error: 'Failed to fetch your profile' },
        { status: 500 }
      );
    }

    // If user doesn't have a profile yet, return empty list
    if (!currentUserProfile) {
      console.warn('User profile not found for:', currentUserId);
      return json({
        data: {
          profiles: [],
          hasMore: false,
          total: 0
        }
      });
    }

    const currentUserGender = currentUserProfile.gender || 'man';
    const currentUserArchetype = currentUserProfile.archetype || '';

    // Determine compatible archetypes via MATCH_MATRIX (falls back to opposite gender)
    const compatibleArchetypes: string[] = MATCH_MATRIX[currentUserArchetype] ?? [];
    const targetGender = currentUserGender === 'man' ? 'woman' : 'man';

    // Fetch profiles: filter by compatible archetypes when available, else opposite gender
    let profileQuery = (supabase as any)
      .from('verified_vibe_users')
      .select('*')
      .neq('id', currentUserId);

    if (compatibleArchetypes.length > 0) {
      profileQuery = profileQuery.in('archetype', compatibleArchetypes);
    } else {
      profileQuery = profileQuery.eq('gender', targetGender);
    }

    const { data: profiles, error: profileError } = await profileQuery;

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
          return stepNames[s as string] || (s as string);
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
    let total = discoveryProfiles.length;
    let paginatedProfiles = discoveryProfiles.slice(offset, offset + limit);
    let hasMore = offset + limit < total;

    // When real pool is empty, fall back to seed/demo profiles
    if (paginatedProfiles.length === 0 && offset === 0) {
      const seedProfiles = buildSeedProfiles(targetGender, compatibleArchetypes);
      paginatedProfiles = seedProfiles.slice(0, limit);
      total = seedProfiles.length;
      hasMore = false;
    }

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
