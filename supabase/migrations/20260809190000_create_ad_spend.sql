-- What the adverts cost, next to what they produced.
--
-- Without this table the ad dashboard can count installs and signups but cannot
-- divide by anything, so "spend more here, pause that" is unanswerable by
-- construction. Cost is the only column that turns a conversion count into a
-- decision.
--
-- WHY THE PRIMARY KEY IS THE WHOLE GRAIN. Snap finalises metrics 48 hours after
-- the end of a day, and Meta restates for longer — the same (day, campaign) is
-- fetched repeatedly and the number legitimately CHANGES. An insert-only design
-- would accumulate duplicate days and double every total; an upsert on this key
-- lets the sync re-fetch a trailing window and have the newest answer simply
-- replace the older one. The empty-string defaults on the id columns are what
-- make that key usable: a null in a primary key is not allowed, and account-level
-- rows genuinely have no campaign.
--
-- SPEND IS STORED IN THE ACCOUNT'S OWN CURRENCY, as numeric rather than float.
-- Snap reports micro-currency integers, which divide exactly by 1,000,000 into
-- numeric and inexactly into a double. Reporting converts at display time using
-- ad_fx_rates; converting on the way in would bake one day's rate permanently
-- into the stored history and make yesterday's spend change whenever the rupee
-- moved.
--
-- `date` IS THE NETWORK'S DATE, NOT OURS. Both networks report against their ad
-- account's timezone, which is not necessarily the IST day the rest of the
-- dashboard uses. Storing the reported date verbatim and recording which
-- timezone produced it keeps the discrepancy visible and fixable, instead of
-- silently joining a Snap day to an app day that covers different hours.

create table if not exists public.ad_spend_daily (
  network text not null check (network in ('snap', 'meta')),
  date date not null,

  -- Empty string rather than null: these are primary key columns, and an
  -- account-level or campaign-level row has no ad set or creative.
  campaign_id text not null default '',
  campaign_name text,
  ad_set_id text not null default '',
  ad_set_name text,
  creative_id text not null default '',
  creative_name text,

  spend numeric(18, 6) not null default 0,
  currency text not null,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  network_conversions bigint not null default 0,

  -- The timezone the network's `date` is expressed in. See the note above.
  account_timezone text,

  -- Surfaced in the dashboard's data-health panel. A sync that quietly stopped
  -- three days ago looks exactly like a campaign that spent nothing, and the
  -- difference is the entire decision.
  fetched_at timestamptz not null default now(),
  source text not null default 'api' check (source in ('api', 'manual')),

  primary key (network, date, campaign_id, ad_set_id, creative_id)
);

create index if not exists ad_spend_daily_date_idx
  on public.ad_spend_daily (date desc);

create index if not exists ad_spend_daily_campaign_idx
  on public.ad_spend_daily (campaign_name, date desc);

alter table public.ad_spend_daily enable row level security;

comment on table public.ad_spend_daily is
  'Daily ad spend per network/campaign/ad set/creative, in the ad account''s own currency. Upserted on the full grain because both networks restate figures after the fact — Snap finalises 48h after day end.';


-- Exchange rates, so spend can be READ in rupees or dollars without being
-- STORED in either.
--
-- Reporting defaults to INR with a USD toggle. Doing that conversion at display
-- time needs a rate per day: using today's rate for last month's spend would
-- make historical numbers drift every time the currency moved, and a report that
-- changes when nothing happened is a report nobody trusts twice.
create table if not exists public.ad_fx_rates (
  date date not null,
  base text not null,
  quote text not null,
  rate numeric(18, 8) not null check (rate > 0),
  source text not null default 'manual',
  fetched_at timestamptz not null default now(),
  primary key (date, base, quote)
);

alter table public.ad_fx_rates enable row level security;

comment on table public.ad_fx_rates is
  'Daily FX rates for reporting ad spend in a currency other than the ad account''s. 1 unit of `base` = `rate` units of `quote`.';
