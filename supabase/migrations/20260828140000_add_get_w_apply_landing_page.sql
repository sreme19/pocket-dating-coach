-- Add 'get_w_apply' — the post-lead-form qualification page — to the landing
-- pages our marketing tables accept, and create the table that records the age
-- answer she gives on it.
--
-- WHY THE CHECK CONSTRAINTS COME FIRST. This repeats 20260825120000 deliberately.
-- `LandingPage` in src/lib/marketing/page-view-report.ts says "Must match the
-- table's check constraint," and reportPageView()/reportStoreClick() post `page`
-- straight through. /get/w shipped in d1b04182 with the constraint and the type
-- updated but not the beacon endpoints, and every view on that page was silently
-- discarded while the ads spent normally. Views are this audience's success
-- metric, so that measured a permanent zero. All five places are changed in this
-- pass: both constraints here, the LandingPage type, and the ALLOWED_PAGES set in
-- each of the three /api/marketing endpoints.
--
-- Note, carried forward from 20260825120000: public.marketing_store_clicks.page
-- is deliberately NOT constrained — free text since 20260809171948. If a later
-- migration adds a check, it must include 'get_w_apply' alongside the rest.

alter table public.marketing_page_views
  drop constraint if exists marketing_page_views_page_check;

alter table public.marketing_page_views
  add constraint marketing_page_views_page_check
  check (page in ('get', 'get_w', 'get_photos', 'aibestie', 'get_w_apply'));

alter table public.marketing_leads
  drop constraint if exists marketing_leads_page_check;

alter table public.marketing_leads
  add constraint marketing_leads_page_check
  check (page in ('get', 'get_w', 'get_photos', 'aibestie', 'get_w_apply'));

-- The age answer from /get/w-apply.
--
-- WHY A SEPARATE TABLE, not a column on marketing_leads. On this funnel the lead
-- is captured inside Meta's instant form and never reaches us at submit time —
-- v1 exports it by hand. So there is no marketing_leads row to hang the age off.
-- What this table holds is the other half: the Meta lead id carried through the
-- thank-you screen as `ra_lead`, joined to the age she declared and to the visit
-- that produced it. The CSV export and this table join on ra_lead.
--
-- NO CONTACT DETAILS LIVE HERE, on purpose. Her name, phone and email stay in
-- Meta until someone exports them. This table carries an opaque id, a band and a
-- verdict — enough to close the attribution loop and to know who to suppress,
-- and nothing that turns a measurement table into a contact list.
create table if not exists public.marketing_apply_gate (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),

  -- Meta's lead id, from ?ra_lead=. The join key to the exported lead.
  -- Nullable because a visit that never answers still deserves a denominator.
  ra_lead        text,

  -- Same id the page-view beacon used, so this joins to the arrival.
  visit_id       text,

  -- What she tapped. '18-20' | '21-24' | '25-30' | '31+' | 'under-18'.
  age_band       text not null,

  -- Whether that answer passed the 18+ gate. Stored rather than derived so a
  -- later change to the bands cannot silently rewrite history.
  qualified      boolean not null,

  campaign       text,
  utm            jsonb not null default '{}'::jsonb,
  user_agent     text,
  country        text,
  city           text,
  region         text,

  constraint marketing_apply_gate_age_band_check
    check (age_band in ('18-20', '21-24', '25-30', '31+', 'under-18'))
);

-- The suppression query. Anyone who declared under 18 gave us contact details
-- inside Meta BEFORE the gate, and those have to be pulled from the export
-- rather than merely ignored — see the page's own comment and DPDP on a child's
-- data. This index is what makes that a one-line lookup at export time.
create index if not exists marketing_apply_gate_unqualified_idx
  on public.marketing_apply_gate (created_at desc)
  where qualified = false;

create index if not exists marketing_apply_gate_ra_lead_idx
  on public.marketing_apply_gate (ra_lead)
  where ra_lead is not null;

alter table public.marketing_apply_gate enable row level security;

-- Same posture as the other marketing tables: writes arrive through the server
-- with the service role, which bypasses RLS. No policy is granted to anon or
-- authenticated, so a browser cannot read one row of this back.
