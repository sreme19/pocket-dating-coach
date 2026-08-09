/**
 * Land a member's install attribution, once.
 *
 * The device reads the Play install referrer at first launch and holds it until
 * there is a session to attach it to. This writes that down next to the member,
 * which is the piece the whole ad dashboard turns on: without it, every stage of
 * the journey after the install is recorded with no campaign attached, and
 * "which advert produced members rather than installs?" cannot be asked in SQL.
 *
 * FIRST TOUCH WINS, enforced here rather than trusted to the caller. The device
 * retries this call — it fires at startup and again after the onboarding step
 * that writes gender — and a reinstall months later can present a newer
 * referrer. An upsert that overwrote would silently move a member from the
 * campaign that actually recruited them onto whichever one they saw last, and
 * the older the account the more wrong the number would get.
 */

import { getSupabase } from '$lib/server/supabase';

export interface AcquisitionInput {
  userId: string;
  utm: Record<string, string>;
  referrerRaw: string | null;
  landingPage: string | null;
  claimCode: string | null;
  platform: 'android' | 'ios';
  capturedAt: string | null;
}

export interface AcquisitionResult {
  recorded: boolean;
  reason?: string;
}

export async function recordAcquisition(input: AcquisitionInput): Promise<AcquisitionResult> {
  try {
    const supabase = getSupabase();

    const { error } = await supabase.from('user_acquisition').upsert(
      {
        user_id: input.userId,
        // Broken out because every report groups by these. Digging them out of
        // jsonb per query is how two charts end up disagreeing about what
        // "campaign" meant.
        network: input.utm.utm_source ?? null,
        medium: input.utm.utm_medium ?? null,
        campaign: input.utm.utm_campaign ?? null,
        ad_set: input.utm.utm_term ?? null,
        creative: input.utm.utm_content ?? null,
        utm: input.utm,
        referrer_raw: input.referrerRaw,
        landing_page: input.landingPage,
        claim_code: input.claimCode,
        platform: input.platform,
        captured_at: input.capturedAt
      },
      { onConflict: 'user_id', ignoreDuplicates: true }
    );

    // Checked, not assumed: PostgREST returns a missing table or a policy
    // refusal in `error` rather than throwing. Until the migration is run every
    // install would otherwise fail to attribute in complete silence, and the
    // dashboard would report an honest-looking zero.
    if (error) {
      console.error('[attribution] install NOT recorded:', error.message, error.hint ?? '');
      return { recorded: false, reason: error.message };
    }

    return { recorded: true };
  } catch (err) {
    console.error('[attribution] failed to record install', err);
    return { recorded: false, reason: 'exception' };
  }
}
