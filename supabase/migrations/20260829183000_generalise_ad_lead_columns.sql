-- Make the ad-lead columns network-neutral, so Meta lands in the same shape.
--
-- WHY NOW. 20260829144332 added these columns named for Snap, because Snap was
-- the only network delivering leads. Meta turns out to need the same seven
-- concepts under different names: it has a leadgen webhook AND -- unlike Snap --
-- a real GET /{form_id}/leads endpoint, so its 122 existing leads are
-- backfillable through the API rather than a spreadsheet.
--
-- The alternative was a parallel meta_* family beside snap_*. That leaves the
-- table carrying two half-empty column sets forever and forces every query to
-- coalesce them, to encode a distinction `source` already makes.
--
-- This runs while marketing_leads still has ZERO rows, which is the only reason
-- it is a rename and not a data migration. The Snap backfill of 260 exported
-- leads was deliberately held until after this landed.
--
-- NAMING. `ad_group` rather than Snap's `ad_squad` or Meta's `ad_set`: both
-- networks have the concept, neither name is neutral, and Google's term is the
-- one that reads as generic here.

alter table public.marketing_leads
  rename column snap_lead_id to ad_lead_id;
alter table public.marketing_leads
  rename column snap_form_id to ad_form_id;
alter table public.marketing_leads
  rename column snap_campaign_id to ad_campaign_id;
alter table public.marketing_leads
  rename column snap_ad_squad_id to ad_group_id;
alter table public.marketing_leads
  rename column snap_ad_squad_name to ad_group_name;
alter table public.marketing_leads
  rename column snap_ad_id to ad_id;
alter table public.marketing_leads
  rename column snap_ad_name to ad_name;

alter index if exists marketing_leads_snap_lead_id_idx
  rename to marketing_leads_ad_lead_id_idx;

-- `source` is what says which network a row came from, and it is now carrying
-- the weight the column prefixes used to. Meta joins the closed set.
alter table public.marketing_leads
  drop constraint if exists marketing_leads_source_check;
alter table public.marketing_leads
  add constraint marketing_leads_source_check
  check (source in ('landing_page', 'snap_lead_form', 'meta_lead_form'));

-- Same for `page`, which is NOT NULL and closed. A Meta lead touched no page of
-- ours either.
--
-- These values stay unreachable from the browser beacons on purpose -- see
-- 20260829144332's note. Only the two webhook routes write them.
alter table public.marketing_leads
  drop constraint if exists marketing_leads_page_check;
alter table public.marketing_leads
  add constraint marketing_leads_page_check
  check (page in ('get', 'get_w', 'get_photos', 'aibestie', 'get_w_apply',
                  'snap_lead_form', 'meta_lead_form'));

-- ad_lead_id is unique per network in practice, but the ids are opaque strings
-- from two different systems. Keeping the index on the bare column (rather than
-- on (source, ad_lead_id)) means a collision across networks would be caught
-- rather than silently allowed -- there is no legitimate reason for a Snap lead
-- id and a Meta lead id to be equal, and if they ever are, one of them is wrong.
