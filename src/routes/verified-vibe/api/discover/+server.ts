import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { DiscoveryProfile } from '$lib/verified-vibe/types';

/**
 * GET /api/verified-vibe/discover
 *
 * Fetch discovery profiles for the current user.
 *
 * Query Parameters:
 * - limit: number of profiles to return (default: 10)
 * - offset: number of profiles to skip (default: 0)
 * - sortBy: 'trustScore' or 'compatibility' (default: 'trustScore')
 * - excludeIds: comma-separated list of profile IDs to exclude
 *
 * Response:
 * {
 *   data: {
 *     profiles: DiscoveryProfile[],
 *     hasMore: boolean
 *   }
 * }
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const sortBy = url.searchParams.get('sortBy') || 'trustScore';
    const excludeIdsParam = url.searchParams.get('excludeIds');
    const excludeIds = excludeIdsParam ? excludeIdsParam.split(',') : [];

    // TODO: Get user from session
    // const session = await getSession(request);
    // if (!session) {
    //   return json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // TODO: Fetch from Supabase with matching algorithm
    // - Get user's archetype and preferences
    // - Query compatible profiles
    // - Filter out already liked/passed profiles
    // - Sort by trust score and compatibility

    // Mock response with diverse profiles
    const allProfiles: DiscoveryProfile[] = [
      {
        id: 'uuid-1',
        gender: 'woman',
        archetype: 'spoiled_casual_woman',
        firstName: 'Sarah',
        age: 26,
        city: 'Brooklyn, NY',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
        about: 'Looking for someone genuine and ambitious.',
        looking: 'Serious relationship',
        trustScore: 81,
        distance: '2 mi',
        verified: ['id', 'liveness', 'photos'],
        photos: [
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
          'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop'
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'uuid-2',
        gender: 'woman',
        archetype: 'spoiled_casual_woman',
        firstName: 'Emma',
        age: 24,
        city: 'Manhattan, NY',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
        about: 'Creative professional seeking meaningful connections.',
        looking: 'Casual dating',
        trustScore: 76,
        distance: '5 mi',
        verified: ['id', 'photos'],
        photos: [
          'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
          'https://images.unsplash.com/photo-1517841905240-74386c8b7167?w=400&h=400&fit=crop'
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'uuid-3',
        gender: 'woman',
        archetype: 'spoiled_casual_woman',
        firstName: 'Jessica',
        age: 28,
        city: 'Williamsburg, NY',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop',
        about: 'Entrepreneur with a passion for travel.',
        looking: 'Serious relationship',
        trustScore: 88,
        distance: '3 mi',
        verified: ['id', 'liveness', 'photos', 'spending_or_qa'],
        photos: [
          'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
          'https://images.unsplash.com/photo-1516228714154-ef7a2c6b3d7d?w=400&h=400&fit=crop'
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'uuid-4',
        gender: 'woman',
        archetype: 'forever_focused_woman',
        firstName: 'Maya',
        age: 25,
        city: 'Park Slope, NY',
        avatar: 'https://images.unsplash.com/photo-1517841905240-74386c8b7167?w=400&h=400&fit=crop',
        about: 'Artist and dog lover. Looking for genuine connection.',
        looking: 'Serious relationship',
        trustScore: 79,
        distance: '4 mi',
        verified: ['id', 'photos'],
        photos: [
          'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop',
          'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop'
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'uuid-5',
        gender: 'woman',
        archetype: 'spoiled_casual_woman',
        firstName: 'Olivia',
        age: 27,
        city: 'Upper West Side, NY',
        avatar: 'https://images.unsplash.com/photo-1516228714154-ef7a2c6b3d7d?w=400&h=400&fit=crop',
        about: 'Finance professional who loves hiking and good wine.',
        looking: 'Serious relationship',
        trustScore: 85,
        distance: '6 mi',
        verified: ['id', 'liveness', 'photos', 'spending_or_qa'],
        photos: [
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
          'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
          'https://images.unsplash.com/photo-1517841905240-74386c8b7167?w=400&h=400&fit=crop'
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'uuid-6',
        gender: 'woman',
        archetype: 'forever_focused_woman',
        firstName: 'Sophie',
        age: 23,
        city: 'East Village, NY',
        avatar: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=400&h=400&fit=crop',
        about: 'Teacher and book enthusiast. Values honesty and kindness.',
        looking: 'Casual dating',
        trustScore: 72,
        distance: '2 mi',
        verified: ['id', 'photos'],
        photos: [
          'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop',
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop'
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    // Filter out excluded profiles
    let filteredProfiles = allProfiles.filter(p => !excludeIds.includes(p.id));

    // Sort by specified criteria
    if (sortBy === 'trustScore') {
      filteredProfiles.sort((a, b) => b.trustScore - a.trustScore);
    } else if (sortBy === 'compatibility') {
      // TODO: Implement compatibility scoring
      filteredProfiles.sort((a, b) => b.trustScore - a.trustScore);
    }

    // Paginate
    const paginatedProfiles = filteredProfiles.slice(offset, offset + limit);
    const hasMore = offset + limit < filteredProfiles.length;

    return json(
      {
        data: {
          profiles: paginatedProfiles,
          hasMore
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Discover fetch error:', error);
    return json(
      { error: 'Failed to fetch discovery cards' },
      { status: 500 }
    );
  }
};
