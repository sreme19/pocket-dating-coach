-- Least-privilege, read-only Postgres role for the ad-management-agent repo's
-- secondary/exploratory query channel (SPEC.md "Data access" — the primary
-- channel is /api/internal/ad-analytics, which owns every rate and gate this
-- role must never be used to recompute).
--
-- This is a plain database role with explicit table grants, not an RLS policy
-- on the service role: the service role already bypasses RLS by default, so
-- scoping access through RLS here would mean trusting a policy to override
-- that bypass. A role with its own login and explicit GRANTs is simpler to
-- audit — `\du+ ads_agent_ro` and `\z <table>` show the entire privilege
-- surface directly, with no bypass to reason about.
--
-- HARD BOUNDARY: this role must never gain access, directly or through a
-- view, to verified_vibe_users or any other table carrying member names,
-- emails, chat transcripts, trust scores, or other personal data. The agent
-- this role serves is designed to never see member data — marketing and
-- spend tables only.
--
-- This migration does NOT set a password. Run it as-is, then set the
-- password separately with a statement that is never committed to source
-- (see the PR/handoff notes for the one-off ALTER ROLE command and the
-- resulting connection string).

create role ads_agent_ro with login;

grant connect on database postgres to ads_agent_ro;
grant usage on schema public to ads_agent_ro;

grant select on public.ad_spend_daily to ads_agent_ro;
grant select on public.ad_demographics_daily to ads_agent_ro;
grant select on public.marketing_page_views to ads_agent_ro;
grant select on public.marketing_store_clicks to ads_agent_ro;
grant select on public.user_acquisition to ads_agent_ro;
grant select on public.ad_fx_rates to ads_agent_ro;

-- Explicit belt-and-suspenders: this role gets nothing beyond the six GRANTs
-- above. New tables added later to public do not become visible to it
-- (no ALTER DEFAULT PRIVILEGES here, deliberately) and it is never granted
-- membership in any other role.
