/**
 * profileService.ts
 *
 * Client-side CRUD for verified_vibe_profiles and verified_vibe_verification_steps.
 * All calls use the anon-key client — RLS ensures users can only touch their own rows.
 */

import { getSupabaseClient } from '$lib/client/supabase';
import type { Gender, Archetype } from '$lib/verified-vibe/types';

// ============================================================================
// Types
// ============================================================================

export interface VVProfile {
  id: string;
  email: string;
  gender: Gender | null;
  archetype: Archetype | null;
  first_name: string | null;
  age: number | null;
  city: string | null;
  created_at: string;
  updated_at: string;
}

export interface VVVerificationStep {
  id: string;
  user_id: string;
  step: 'id' | 'liveness' | 'photos' | 'spending_or_qa';
  trust_points: number;
  data: Record<string, unknown> | null;
  completed_at: string;
}

export type ProfileCompleteness =
  | 'no_profile'      // new user — send to gate
  | 'no_archetype'    // has gender — send to home
  | 'no_verification' // has archetype — send to verify
  | 'complete';       // all 4 steps done — send to discover

const REQUIRED_STEPS = ['id', 'liveness', 'photos', 'spending_or_qa'] as const;

// ============================================================================
// Profile
// ============================================================================

/**
 * Get the current user's profile, or null if it doesn't exist yet.
 */
export async function getProfile(): Promise<VVProfile | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await (supabase as any)
    .from('verified_vibe_profiles')
    .select('*')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // no rows
    console.error('getProfile error:', error);
    return null;
  }
  return data as VVProfile;
}

/**
 * Create or update the current user's profile.
 * Automatically sets the id from the active session.
 */
export async function upsertProfile(
  updates: Partial<Omit<VVProfile, 'id' | 'created_at' | 'updated_at'>>
): Promise<VVProfile | null> {
  const supabase = getSupabaseClient();

  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;
  if (!session) throw new Error('Not authenticated');

  const row = {
    id: session.user.id,
    email: session.user.email ?? '',
    ...updates
  };

  const { data, error } = await (supabase as any)
    .from('verified_vibe_profiles')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('upsertProfile error:', error);
    throw error;
  }
  return data as VVProfile;
}

// ============================================================================
// Verification steps
// ============================================================================

/**
 * Get all completed verification steps for the current user.
 */
export async function getVerificationSteps(): Promise<VVVerificationStep[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await (supabase as any)
    .from('verified_vibe_verification_steps')
    .select('*')
    .order('completed_at', { ascending: true });

  if (error) {
    console.error('getVerificationSteps error:', error);
    return [];
  }
  return (data ?? []) as VVVerificationStep[];
}

/**
 * Mark a verification step as complete for the current user (upsert-safe).
 */
export async function saveVerificationStep(
  step: VVVerificationStep['step'],
  trustPoints: number,
  data?: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseClient();

  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;
  if (!session) throw new Error('Not authenticated');

  const { error } = await (supabase as any)
    .from('verified_vibe_verification_steps')
    .upsert(
      {
        user_id: session.user.id,
        step,
        trust_points: trustPoints,
        data: data ?? null,
        completed_at: new Date().toISOString()
      },
      { onConflict: 'user_id,step' }
    );

  if (error) {
    console.error('saveVerificationStep error:', error);
    throw error;
  }
}

// ============================================================================
// Completeness helpers
// ============================================================================

/**
 * Returns total trust score from all completed steps.
 */
export function totalTrustPoints(steps: VVVerificationStep[]): number {
  return steps.reduce((sum, s) => sum + s.trust_points, 0);
}

/**
 * Checks whether all 4 verification steps are done.
 */
export function isFullyVerified(steps: VVVerificationStep[]): boolean {
  const completedSteps = steps.map((s) => s.step);
  return REQUIRED_STEPS.every((s) => completedSteps.includes(s));
}

/**
 * Returns where the user should be routed after authentication.
 */
export async function getProfileCompleteness(): Promise<ProfileCompleteness> {
  const profile = await getProfile();
  if (!profile || !profile.gender) return 'no_profile';
  if (!profile.archetype) return 'no_archetype';

  const steps = await getVerificationSteps();
  if (!isFullyVerified(steps)) return 'no_verification';

  return 'complete';
}

/**
 * Route string for a given completeness state.
 */
export function routeForCompleteness(c: ProfileCompleteness): string {
  switch (c) {
    case 'no_profile':      return '/verified-vibe/gate';
    case 'no_archetype':    return '/verified-vibe/home';
    case 'no_verification': return '/verified-vibe/verify';
    case 'complete':        return '/verified-vibe/discover';
  }
}
