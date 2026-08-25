-- Add 'get_w' — the women's variant of the /get landing page — to the set of
-- landing pages our own marketing tables will accept.
--
-- WHY THIS MIGRATION IS LOAD-BEARING, not bookkeeping. `LandingPage` in
-- src/lib/marketing/page-view-report.ts carries the comment "Must match the
-- table's check constraint," and it means it: reportPageView() and
-- reportStoreClick() both post `page` straight through to these tables. Ship
-- /get/w without this migration and every arrival and every store tap from the
-- women's page is rejected at write time — the page looks fine, the ads spend
-- normally, and the measurement is a silent permanent zero.
--
-- That is the same shape as the 2026-08-21 Snap incident (a week of installs
-- with no utm_id, discovered only afterwards), which is exactly the failure
-- mode worth not repeating.
--
-- Note: public.marketing_store_clicks.page is deliberately NOT constrained —
-- it was added as free text in 20260809171948 and never given a check. If a
-- later migration adds one, it must include 'get_w' alongside the values below.

alter table public.marketing_page_views
  drop constraint if exists marketing_page_views_page_check;

alter table public.marketing_page_views
  add constraint marketing_page_views_page_check
  check (page in ('get', 'get_w', 'get_photos', 'aibestie'));

alter table public.marketing_leads
  drop constraint if exists marketing_leads_page_check;

alter table public.marketing_leads
  add constraint marketing_leads_page_check
  check (page in ('get', 'get_w', 'get_photos', 'aibestie'));
