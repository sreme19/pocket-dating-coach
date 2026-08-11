/**
 * Record an arrival on a paid landing page.
 *
 * Separate from marketing-conversions.ts on purpose: that module's job is
 * forwarding a conversion to Snap and Meta and it is shaped around surviving
 * that round trip. A view is not forwarded anywhere — both browser pixels
 * already send their own PAGE_VIEW, and unlike the store-click event that one
 * has always worked, because an arrival sits on the page far longer than the
 * ~1s pixel flush timer. All this needs to do is write the row the pixels
 * cannot give us back: the denominator for tap rate, in our own database, in
 * SQL, now rather than in someone's dashboard twenty minutes from now.
 *
 * Never throws. Called from a beacon fired by anonymous traffic with nobody on
 * the other end to receive an error.
 */

import { getSupabase } from '$lib/server/supabase';
import type { LandingPage } from '$lib/marketing/page-view-report';

export interface PageViewInput {
  visitId: string;
  page: LandingPage;
  campaign: string | null;
  utm: Record<string, string>;
  userAgent: string | null;
  country: string | null;
  /** Edge-resolved city, decoded. Same address, same non-retention. */
  city: string | null;
  /** Edge-resolved subdivision, bare ISO 3166-2 code. */
  region: string | null;
  referrer: string | null;
}

export async function recordPageView(input: PageViewInput): Promise<void> {
  try {
    const supabase = getSupabase();

    const base = {
      visit_id: input.visitId,
      page: input.page,
      campaign: input.campaign,
      utm: input.utm,
      user_agent: input.userAgent,
      referrer: input.referrer,
      country: input.country
    };

    // Unique on (visit_id, page): a reload inside the same session updates
    // nothing and inserts nothing. Counting it again would inflate the
    // denominator of every tap rate on the dashboard — the specific way a
    // conversion rate ends up reading above 100% and nobody can explain why.
    let { error } = await supabase
      .from('marketing_page_views')
      .upsert(
        { ...base, city: input.city, region: input.region },
        { onConflict: 'visit_id,page', ignoreDuplicates: true }
      );

    /**
     * Write the older shape if city/region are not in the database yet.
     *
     * The migration adding them is run by hand in a SQL editor, separately from
     * the deploy, so there is a window in which PostgREST rejects the entire row
     * for naming a column that does not exist. This table is the DENOMINATOR of
     * every tap rate on the dashboard: losing two columns of geography costs a
     * breakdown, whereas losing the row costs the rate itself and makes taps look
     * like they arrived from nowhere.
     */
    if (error?.code === 'PGRST204') {
      console.warn(
        '[marketing] page view: city/region missing, retrying without — run 20260811065354_add_city_region_to_marketing_tables.sql:',
        error.message
      );
      ({ error } = await supabase
        .from('marketing_page_views')
        .upsert(base, { onConflict: 'visit_id,page', ignoreDuplicates: true }));
    }

    // Checked rather than assumed: PostgREST reports a missing table or a policy
    // refusal in `error` instead of throwing, so a bare try/catch would let this
    // fail in total silence — on the table whose entire purpose is to be the
    // number we can still trust when the vendor dashboards disagree. Until the
    // migration is run this is exactly the state, and it should say so.
    if (error) {
      console.error('[marketing] page view NOT recorded:', error.message, error.hint ?? '');
    }
  } catch (err) {
    console.error('[marketing] failed to record page view', err);
  }
}
