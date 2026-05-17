import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { DiscoveryProfile } from '$lib/verified-vibe/types';

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
 * Excludes the current user and any blocked/passed users.
 *
 * Query parameters:
 * - limit: number of profiles to return (default: 10, max: 50)
 * - offset: pagination offset (default: 0)
 * - excludeIds: comma-separated list of user IDs to exclude
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
export const GET: RequestHandler = async ({ url }) => {
  try {
    // Parse query parameters
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const excludeIdsParam = url.searchParams.get('excludeIds');
    const sortBy = (url.searchParams.get('sortBy') || 'trustScore') as 'trustScore' | 'compatibility';

    // Parse exclude IDs
    const excludeIds = excludeIdsParam ? excludeIdsParam.split(',') : [];

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

    // Mock data for discovery feed
    // In production, this would query the database
    const mockProfiles: DiscoveryProfile[] = [
      {
        id: '1',
        gender: 'woman',
        archetype: 'spoilt_woman',
        firstName: 'Sarah',
        age: 26,
        city: 'Brooklyn, NY',
        avatar: null,
        about: 'Looking for someone genuine and ambitious. Love trying new restaurants and weekend trips.',
        looking: 'Long-term relationship',
        trustScore: 88,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
        distance: '2 mi',
        verified: ['ID', 'Liveness', 'Photos', 'Q&A']
      },
      {
        id: '2',
        gender: 'woman',
        archetype: 'spoilt_woman',
        firstName: 'Emma',
        age: 24,
        city: 'Manhattan, NY',
        avatar: null,
        about: 'Creative professional seeking meaningful connections. Coffee enthusiast.',
        looking: 'Casual dating',
        trustScore: 76,
        createdAt: new Date('2024-01-10'),
        updatedAt: new Date('2024-01-10'),
        distance: '5 mi',
        verified: ['ID', 'Liveness', 'Photos']
      },
      {
        id: '3',
        gender: 'woman',
        archetype: 'safety_first_woman',
        firstName: 'Jessica',
        age: 28,
        city: 'Williamsburg, NY',
        avatar: null,
        about: 'Entrepreneur with a passion for travel and good conversation.',
        looking: 'Long-term relationship',
        trustScore: 92,
        createdAt: new Date('2024-01-20'),
        updatedAt: new Date('2024-01-20'),
        distance: '3 mi',
        verified: ['ID', 'Liveness', 'Photos', 'Q&A']
      },
      {
        id: '4',
        gender: 'woman',
        archetype: 'spoilt_woman',
        firstName: 'Amanda',
        age: 25,
        city: 'Park Slope, NY',
        avatar: null,
        about: 'Artist and yoga instructor. Looking for someone who appreciates the finer things.',
        looking: 'Long-term relationship',
        trustScore: 81,
        createdAt: new Date('2024-01-18'),
        updatedAt: new Date('2024-01-18'),
        distance: '4 mi',
        verified: ['ID', 'Liveness', 'Photos']
      },
      {
        id: '5',
        gender: 'woman',
        archetype: 'safety_first_woman',
        firstName: 'Rachel',
        age: 27,
        city: 'Upper West Side, NY',
        avatar: null,
        about: 'Lawyer by day, foodie by night. Seeking genuine connection.',
        looking: 'Long-term relationship',
        trustScore: 85,
        createdAt: new Date('2024-01-12'),
        updatedAt: new Date('2024-01-12'),
        distance: '6 mi',
        verified: ['ID', 'Liveness', 'Photos', 'Q&A']
      },
      {
        id: '6',
        gender: 'woman',
        archetype: 'spoilt_woman',
        firstName: 'Nicole',
        age: 23,
        city: 'Astoria, NY',
        avatar: null,
        about: 'Marketing manager with a love for travel and adventure.',
        looking: 'Casual dating',
        trustScore: 72,
        createdAt: new Date('2024-01-08'),
        updatedAt: new Date('2024-01-08'),
        distance: '8 mi',
        verified: ['ID', 'Liveness']
      },
      {
        id: '7',
        gender: 'woman',
        archetype: 'safety_first_woman',
        firstName: 'Lauren',
        age: 29,
        city: 'Chelsea, NY',
        avatar: null,
        about: 'Consultant seeking someone ambitious and kind.',
        looking: 'Long-term relationship',
        trustScore: 89,
        createdAt: new Date('2024-01-22'),
        updatedAt: new Date('2024-01-22'),
        distance: '7 mi',
        verified: ['ID', 'Liveness', 'Photos', 'Q&A']
      },
      {
        id: '8',
        gender: 'woman',
        archetype: 'spoilt_woman',
        firstName: 'Sophia',
        age: 26,
        city: 'Tribeca, NY',
        avatar: null,
        about: 'Fashion designer looking for someone who gets me.',
        looking: 'Long-term relationship',
        trustScore: 87,
        createdAt: new Date('2024-01-19'),
        updatedAt: new Date('2024-01-19'),
        distance: '2 mi',
        verified: ['ID', 'Liveness', 'Photos', 'Q&A']
      },
      {
        id: '9',
        gender: 'woman',
        archetype: 'safety_first_woman',
        firstName: 'Victoria',
        age: 30,
        city: 'SoHo, NY',
        avatar: null,
        about: 'Executive seeking genuine connection with someone special.',
        looking: 'Long-term relationship',
        trustScore: 91,
        createdAt: new Date('2024-01-21'),
        updatedAt: new Date('2024-01-21'),
        distance: '1 mi',
        verified: ['ID', 'Liveness', 'Photos', 'Q&A']
      },
      {
        id: '10',
        gender: 'woman',
        archetype: 'spoilt_woman',
        firstName: 'Olivia',
        age: 25,
        city: 'Nolita, NY',
        avatar: null,
        about: 'Photographer and adventurer. Love spontaneous trips.',
        looking: 'Casual dating',
        trustScore: 78,
        createdAt: new Date('2024-01-14'),
        updatedAt: new Date('2024-01-14'),
        distance: '3 mi',
        verified: ['ID', 'Liveness', 'Photos']
      }
    ];

    // Filter out excluded IDs
    let filtered = mockProfiles.filter(p => !excludeIds.includes(p.id));

    // Sort by selected criteria
    if (sortBy === 'trustScore') {
      filtered.sort((a, b) => b.trustScore - a.trustScore);
    } else if (sortBy === 'compatibility') {
      // In production, this would calculate compatibility based on archetype and answers
      // For now, we'll use a mock compatibility score
      filtered.sort((a, b) => {
        const compatA = Math.random() * 100;
        const compatB = Math.random() * 100;
        return compatB - compatA;
      });
    }

    // Apply pagination
    const total = filtered.length;
    const profiles = filtered.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    const response: DiscoveryFeedResponse = {
      data: {
        profiles,
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
