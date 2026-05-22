import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { initializeUserPreferences } from '$lib/server/preferences-initializer';

/**
 * Determine if an archetype string represents a female user.
 * Accepts both enum values ('spoilt_woman', 'safety_first_woman') and
 * rich descriptive labels from seed data ('The NRI / Diaspora-Bridging Woman', etc.)
 */
function isFemaleArchetype(archetype: string): boolean {
  const lower = archetype.toLowerCase();
  return (
    lower === 'spoilt_woman' ||
    lower === 'safety_first_woman' ||
    lower.includes('woman') ||
    lower.includes('female')
  );
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { userId, archetype, about, looking } = body as {
      userId: string;
      archetype: string;
      about: string | null;
      looking: string | null;
    };

    // Validate required fields
    if (!userId || !archetype) {
      return json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Only female archetypes get a preferences profile
    if (!isFemaleArchetype(archetype)) {
      return json(
        { success: false, error: 'Only female archetypes receive a preferences profile' },
        { status: 400 }
      );
    }

    // Verify the caller is authenticated and matches the userId in the body
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user } } = await userClient.auth.getUser();

    if (!user) {
      return json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (user.id !== userId) {
      return json({ success: false, error: 'Forbidden: cannot initialize preferences for another user' }, { status: 403 });
    }

    await initializeUserPreferences(userId, archetype, about, looking);

    return json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('preferences/initialize error:', message);
    return json({ success: false, error: message }, { status: 500 });
  }
};
