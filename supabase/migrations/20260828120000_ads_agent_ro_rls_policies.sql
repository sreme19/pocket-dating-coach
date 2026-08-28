-- Make ads_agent_ro actually able to read the six tables it was granted.
--
-- The 2026-08-21 migration created the role with explicit GRANTs and said, in
-- its own comment, that this was "not an RLS policy" because a plain role with
-- GRANTs is simpler to audit. The reasoning treated GRANTs and RLS as
-- alternatives; in Postgres they are conjunctive. All six tables have RLS
-- ENABLED, and a role that is not the table owner and lacks BYPASSRLS gets
-- rows only through a policy — no policy, zero rows, no error. So since its
-- creation the role has connected successfully and read nothing, silently.
--
-- Found on 2026-08-28 from the ad-management-agent side, the worst way: the
-- first live Meta ad's landing-page views were being verified, Meta reported
-- 87, and marketing_page_views read 0 — which looks exactly like "no ad
-- traffic landed" and is actually "this channel has never returned a row".
-- See that repo's lrn-2026-08-28-channel2-rls-blocks-every-read.
--
-- These policies are deliberately `using (true)`: row-level filtering is not
-- the boundary being enforced here. The boundary is WHICH TABLES the role can
-- see at all, and that stays carried by the GRANTs (there is still no grant,
-- and now demonstrably no policy, on verified_vibe_users or any other member
-- table — the hard boundary in the role migration stands). Scoped `to
-- ads_agent_ro` so these policies widen nothing for anon/authenticated, whose
-- access is unchanged.

create policy ads_agent_ro_read on public.ad_spend_daily
  for select to ads_agent_ro using (true);
create policy ads_agent_ro_read on public.ad_demographics_daily
  for select to ads_agent_ro using (true);
create policy ads_agent_ro_read on public.marketing_page_views
  for select to ads_agent_ro using (true);
create policy ads_agent_ro_read on public.marketing_store_clicks
  for select to ads_agent_ro using (true);
create policy ads_agent_ro_read on public.user_acquisition
  for select to ads_agent_ro using (true);
create policy ads_agent_ro_read on public.ad_fx_rates
  for select to ads_agent_ro using (true);
