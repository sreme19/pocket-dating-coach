-- Land Snap lead-form submissions in marketing_leads automatically.
--
-- WHAT THIS CLOSES. 20260828184124 recorded the gap in its own comment: "on this
-- funnel the lead is captured inside Meta's instant form and never reaches us at
-- submit time -- v1 exports it by hand." The same was true of Snap. Snap's
-- Marketing API has NO endpoint that lists or downloads submitted leads; the only
-- programmatic route is a webhook Snap POSTs per submission
-- (POST /v1/lead_gen/integrations/public_webhook registers it). This migration
-- gives that webhook somewhere to write.
--
-- WHY marketing_leads AND NOT A NEW TABLE. The dialer, the call schedule and the
-- drip already hang off this table. A Snap lead is a contactable person exactly
-- like a /get/w lead is; putting it anywhere else would mean writing a second
-- promotion path before anyone could be called. The cost is that Snap's payload
-- has to be bent to fit constraints written for a landing-page form, which is
-- what most of the rest of this file is.
--
-- DELIVERY IS FORWARD-ONLY. Snap does not backfill a newly registered webhook.
-- Every lead submitted before registration exists only in the Ads Manager export,
-- and Snap deletes leads after 90 days. Those have to be exported by hand; this
-- table will not grow them retroactively.

-- 1. Provenance. Everything already in the table came from a landing-page form,
--    so the default backfills the existing rows correctly.
alter table public.marketing_leads
  add column if not exists source text not null default 'landing_page',
  -- Snap's own id for the submission. The idempotency key: Snap retries a webhook
  -- it did not get a 2xx for, and without a unique index a retry is a second row
  -- and a second phone call to the same person.
  add column if not exists snap_lead_id text,
  add column if not exists snap_form_id text,
  add column if not exists first_name text,
  add column if not exists last_name text,
  -- The ad objects the lead came from, as Snap reports them. Stored as ids AND
  -- names because ad-management-agent's ledger joins on the id while a human
  -- reading this table needs the name.
  add column if not exists snap_campaign_id text,
  add column if not exists snap_ad_squad_id text,
  add column if not exists snap_ad_squad_name text,
  add column if not exists snap_ad_id text,
  add column if not exists snap_ad_name text,
  -- Snap's create_time, which is when SHE submitted. created_at is when we wrote
  -- the row. They differ by the retry window, and attribution wants the former.
  add column if not exists submitted_at timestamptz;

alter table public.marketing_leads
  drop constraint if exists marketing_leads_source_check;
alter table public.marketing_leads
  add constraint marketing_leads_source_check
  check (source in ('landing_page', 'snap_lead_form'));

-- 2. `page` is NOT NULL with a closed check, and a Snap lead never touched a page
--    of ours. 'snap_lead_form' is the honest value.
--
--    NOTE, carried forward from 20260828184124: that migration warns that the
--    LandingPage type and the ALLOWED_PAGES set in the three /api/marketing
--    endpoints must move with this constraint. They deliberately DO NOT here --
--    those endpoints are browser beacons, and no browser may claim to be a Snap
--    webhook. The value is writable only by the webhook route, which does not
--    consult ALLOWED_PAGES. Widening those sets would be a bug, not consistency.
alter table public.marketing_leads
  drop constraint if exists marketing_leads_page_check;
alter table public.marketing_leads
  add constraint marketing_leads_page_check
  check (page in ('get', 'get_w', 'get_photos', 'aibestie', 'get_w_apply', 'snap_lead_form'));

-- 3. contact_kind gains 'phone'.
--
--    WHY NOT REUSE 'whatsapp'. A number typed into our own form is one she offered
--    for WhatsApp; a number Snap prefills from her account is just a phone number,
--    and may not be on WhatsApp at all. Messaging the second as though she had
--    opted into the first is the kind of thing DPDP consent language turns on. The
--    VALUE still lands in whatsapp_e164 -- that column is the phone column in
--    practice, and its unique index is what stops one person becoming two rows --
--    but the kind records what she actually agreed to.
alter table public.marketing_leads
  drop constraint if exists marketing_leads_contact_kind_check;
alter table public.marketing_leads
  add constraint marketing_leads_contact_kind_check
  check (contact_kind in ('whatsapp', 'email', 'phone'));

alter table public.marketing_leads
  drop constraint if exists marketing_leads_has_contact;
alter table public.marketing_leads
  add constraint marketing_leads_has_contact check (
    (contact_kind in ('whatsapp', 'phone') and whatsapp_e164 is not null) or
    (contact_kind = 'email' and email is not null)
  );

-- 4. Idempotency. Partial so the landing-page rows, which have no Snap id, are
--    unaffected -- a plain unique index would collapse every one of them.
create unique index if not exists marketing_leads_snap_lead_id_idx
  on public.marketing_leads (snap_lead_id) where snap_lead_id is not null;

create index if not exists marketing_leads_source_idx
  on public.marketing_leads (source, created_at desc);

-- 5. ads_agent_ro is NOT granted this table, and that is deliberate and unchanged.
--    The role reads aggregate ad performance; marketing_leads is a contact list.
--    ad-management-agent should learn that a campaign produced eleven leads by
--    counting, not by reading eleven phone numbers. If a count is ever needed
--    there, add a view that exposes counts only -- do not grant this table.
