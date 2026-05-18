import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabase } from '$lib/server/supabase';

/**
 * POST /api/verified-vibe/analytics
 *
 * Track user interactions and analytics events. Helps understand user behavior
 * and improve the discovery experience.
 *
 * Request body:
 * {
 *   userId: string,
 *   eventType: 'like' | 'pass' | 'message' | 'report' | 'view' | 'swipe',
 *   profileId?: string,
 *   metadata?: Record<string, any>
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   eventId?: string
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json() as {
      userId: string;
      eventType: 'like' | 'pass' | 'message' | 'report' | 'view' | 'swipe';
      profileId?: string;
      metadata?: Record<string, any>;
    };

    const { userId, eventType, profileId, metadata } = body;

    // Validate required fields
    if (!userId) {
      return json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    if (!eventType) {
      return json(
        { error: 'Missing eventType' },
        { status: 400 }
      );
    }

    // Validate event type
    const validEventTypes = ['like', 'pass', 'message', 'report', 'view', 'swipe'];
    if (!validEventTypes.includes(eventType)) {
      return json(
        { error: 'Invalid eventType' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Record the analytics event
    const { data: event, error: insertError } = await supabase
      .from('verified_vibe_analytics')
      .insert({
        user_id: userId,
        event_type: eventType,
        profile_id: profileId || null,
        metadata: metadata || {},
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error recording analytics:', insertError);
      return json(
        { error: 'Failed to record analytics' },
        { status: 500 }
      );
    }

    return json(
      {
        success: true,
        eventId: event?.id
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Analytics error:', error);
    return json(
      { error: 'Failed to process analytics' },
      { status: 500 }
    );
  }
};

/**
 * GET /api/verified-vibe/analytics
 *
 * Get analytics summary for the current user.
 *
 * Query parameters:
 * - userId: string (required)
 * - days?: number (default: 7)
 *
 * Response:
 * {
 *   success: boolean,
 *   summary: {
 *     totalLikes: number,
 *     totalPasses: number,
 *     totalMessages: number,
 *     totalReports: number,
 *     totalViews: number,
 *     totalSwipes: number,
 *     likeRate: number (percentage),
 *     matchRate: number (percentage)
 *   }
 * }
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const userId = url.searchParams.get('userId');
    const days = parseInt(url.searchParams.get('days') || '7');

    // Validate required fields
    if (!userId) {
      return json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    // Get analytics events
    const { data: events, error: fetchError } = await supabase
      .from('verified_vibe_analytics')
      .select('event_type')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (fetchError) {
      console.error('Error fetching analytics:', fetchError);
      return json(
        { error: 'Failed to fetch analytics' },
        { status: 500 }
      );
    }

    // Calculate summary
    const summary = {
      totalLikes: 0,
      totalPasses: 0,
      totalMessages: 0,
      totalReports: 0,
      totalViews: 0,
      totalSwipes: 0,
      likeRate: 0,
      matchRate: 0
    };

    if (events) {
      for (const event of events) {
        switch (event.event_type) {
          case 'like':
            summary.totalLikes++;
            break;
          case 'pass':
            summary.totalPasses++;
            break;
          case 'message':
            summary.totalMessages++;
            break;
          case 'report':
            summary.totalReports++;
            break;
          case 'view':
            summary.totalViews++;
            break;
          case 'swipe':
            summary.totalSwipes++;
            break;
        }
      }

      // Calculate rates
      const totalActions = summary.totalLikes + summary.totalPasses;
      if (totalActions > 0) {
        summary.likeRate = (summary.totalLikes / totalActions) * 100;
      }

      // TODO: Calculate match rate from matches table
      summary.matchRate = 0;
    }

    return json(
      {
        success: true,
        summary
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Analytics GET error:', error);
    return json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
};

