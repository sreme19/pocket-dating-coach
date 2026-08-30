-- One row per lead-form submission the network actually delivered to us.
--
-- WHY THIS EXISTS, 2026-08-30. Snap Ads Manager reported 9 leads on
-- RA_LEADS_GETW-APPLY_IN_PAN_TOF_202608 while marketing_leads held 7. Nothing was
-- broken: the webhook was registered on all seven forms, the receiver returned 200
-- to Snap's test delivery, and no error was logged anywhere. The two missing rows
-- were dropped by marketing_leads' own unique indexes on whatsapp_e164 and
-- lower(email) -- a person who had already submitted any earlier Riteangle form
-- submits again, recordAdLead catches UNIQUE_VIOLATION, returns
-- { ok: true, duplicate: true }, and the submission exists nowhere.
--
-- That dedupe is CORRECT and is not what this migration changes. marketing_leads
-- is the dialer's table: one person is one row, and she must not be called twice.
-- The defect is that a deduped submission left no trace, so the only count we had
-- disagreed with the network's count and nothing surfaced the difference. It read
-- as an honest 7. The ad-management-agent repo has written this failure shape down
-- twice already (lrn-2026-08-28-channel2-rls-blocks-every-read,
-- lrn-2026-08-29-snap-lead-webhook-only): a channel that returns nothing and looks
-- exactly like the truth.
--
-- So: marketing_leads stays the person. This table is the event. Counting leads is
-- a question about this table; calling a lead is a question about that one.
--
-- DELIBERATELY CARRIES NO CONTACT DETAILS. Only the network's opaque lead id, the
-- ad objects it came from, and what we did with it. Two consequences, both wanted:
-- an under-18 submission can be counted here without a minor's identifiers landing
-- in Postgres (the rule 20260828184124 and the snap-lead receiver both enforce),
-- and ads_agent_ro can be granted this table, so the ad agent can reconcile its
-- own numbers without ever being able to read a phone number or an email.
create table if not exists public.marketing_lead_submissions (
  id uuid primary key default gen_random_uuid(),
  network text not null check (network in ('snap_lead_form', 'meta_lead_form')),
  -- The network's own lead id. Opaque; not a contact detail.
  ad_lead_id text not null,
  ad_form_id text,
  -- What happened to it. 'duplicate' is the case this table was built to make
  -- visible; 'under_18' and 'no_usable_contact' are counted for the same reason,
  -- because the network counted them and so a silent gap would reopen.
  outcome text not null check (
    outcome in ('stored', 'duplicate', 'no_usable_contact', 'under_18')
  ),
  campaign text,
  ad_campaign_id text,
  ad_group_id text,
  ad_group_name text,
  ad_id text,
  ad_name text,
  -- The network's own submit time, not when we wrote the row. The 2026-08-29
  -- import showed why the distinction matters: seven leads submitted across seven
  -- hours all carried a created_at inside the same two minutes, so filtering a
  -- "last 2 days" report on created_at returned a backfill instead of the day.
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

-- A redelivery is the same submission, not a second one. Snap retries anything it
-- did not get a 2xx for and the receiver deliberately enforces no freshness window
-- on the signature timestamp, so retries are expected rather than exceptional.
create unique index if not exists marketing_lead_submissions_lead_idx
  on public.marketing_lead_submissions (network, ad_lead_id);

create index if not exists marketing_lead_submissions_submitted_at_idx
  on public.marketing_lead_submissions (submitted_at desc);

create index if not exists marketing_lead_submissions_campaign_idx
  on public.marketing_lead_submissions (campaign, submitted_at desc);

alter table public.marketing_lead_submissions enable row level security;

comment on table public.marketing_lead_submissions is
  'One row per delivered lead-form submission, including those marketing_leads deduped away. The count of leads is this table; the person is marketing_leads. Carries no contact details on purpose, so it is safe to grant to read-only analytics roles.';

comment on column public.marketing_lead_submissions.outcome is
  'stored = a new marketing_leads row. duplicate = the person already existed (the case this table exists to make visible). no_usable_contact / under_18 = never eligible for a row, but the network still counted the submission.';
