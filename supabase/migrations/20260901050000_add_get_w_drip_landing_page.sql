-- Add 'get_w_drip' — the Gen1 women's email-drip landing page — to the
-- landing pages our marketing tables accept.
--
-- WHY THE CHECK CONSTRAINTS COME FIRST. This repeats 20260828184124 (which
-- itself repeats 20260825120000) deliberately. `LandingPage` in
-- src/lib/marketing/page-view-report.ts says "Must match the table's check
-- constraint," and reportPageView()/reportStoreClick()/submitLead() post
-- `page` straight through. /get/w shipped once with the constraint and the
-- type updated but not the beacon endpoints, and every view on that page was
-- silently discarded while the ads spent normally. All five places move
-- together in this pass: both constraints here, the LandingPage type, and the
-- ALLOWED_PAGES/ALLOWED_CTAS sets in each of the three /api/marketing
-- endpoints (lead, page-view, store-click — the last one also needs its
-- PAGE_PATHS entry).
--
-- Note, carried forward from the prior two migrations:
-- public.marketing_store_clicks.page is deliberately NOT constrained — free
-- text since 20260809171948. If a later migration adds a check, it must
-- include 'get_w_drip' alongside the rest.
--
-- marketing_leads_page_check also has to keep 'snap_lead_form' and
-- 'meta_lead_form' — the two values the webhook routes write that never go
-- through the browser beacon's narrower ALLOWED_PAGES set (see the comment on
-- that Insert type in src/lib/server/supabase.ts). The prior migration file
-- for this table (20260828184124) omitted them; applying it as written
-- against production failed with a check-constraint violation against real
-- snap_lead_form/meta_lead_form rows, caught before anything committed.

alter table public.marketing_page_views
  drop constraint if exists marketing_page_views_page_check;
alter table public.marketing_page_views
  add constraint marketing_page_views_page_check
  check (page in ('get', 'get_w', 'get_photos', 'aibestie', 'get_w_apply', 'get_w_drip'));

alter table public.marketing_leads
  drop constraint if exists marketing_leads_page_check;
alter table public.marketing_leads
  add constraint marketing_leads_page_check
  check (page in ('get', 'get_w', 'get_photos', 'aibestie', 'get_w_apply', 'get_w_drip', 'snap_lead_form', 'meta_lead_form'));
