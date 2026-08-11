create table if not exists public.marketing_page_views (
  id uuid primary key default gen_random_uuid(),
  visit_id text not null,
  page text not null check (page in ('get', 'get_photos', 'aibestie')),
  campaign text,
  utm jsonb not null default '{}'::jsonb,
  user_agent text,
  referrer text,
  country text,
  created_at timestamptz not null default now()
);

create unique index if not exists marketing_page_views_visit_page_idx
  on public.marketing_page_views (visit_id, page);

create index if not exists marketing_page_views_created_at_idx
  on public.marketing_page_views (created_at desc);

create index if not exists marketing_page_views_campaign_idx
  on public.marketing_page_views (campaign, created_at desc);

alter table public.marketing_page_views enable row level security;

comment on table public.marketing_page_views is
  'First-party landing page arrivals. The denominator for store-tap rate, which previously existed only inside Snap and Meta. Joins to marketing_store_clicks on visit_id.';

alter table public.marketing_store_clicks
  add column if not exists visit_id text,
  add column if not exists country text,
  add column if not exists page text;

update public.marketing_store_clicks set page = 'get' where page is null;

create index if not exists marketing_store_clicks_visit_idx
  on public.marketing_store_clicks (visit_id);

create index if not exists marketing_store_clicks_page_idx
  on public.marketing_store_clicks (page, created_at desc);

comment on column public.marketing_store_clicks.visit_id is
  'Joins this tap to its marketing_page_views row. Null for taps recorded before 2026-08-09.';

comment on column public.marketing_store_clicks.page is
  'Which landing page the tap happened on. Back-filled to ''get'' for rows predating /get-photos instrumentation.';

create table if not exists public.user_acquisition (
  user_id uuid primary key references auth.users(id) on delete cascade,
  network text,
  medium text,
  campaign text,
  ad_set text,
  creative text,
  utm jsonb not null default '{}'::jsonb,
  referrer_raw text,
  landing_page text,
  claim_code text,
  platform text check (platform in ('android', 'ios')),
  captured_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_acquisition_campaign_idx
  on public.user_acquisition (campaign, created_at desc);

create index if not exists user_acquisition_landing_page_idx
  on public.user_acquisition (landing_page, created_at desc);

create index if not exists user_acquisition_created_at_idx
  on public.user_acquisition (created_at desc);

alter table public.user_acquisition enable row level security;

comment on table public.user_acquisition is
  'Which campaign, creative and landing page produced each member. Populated from the Play install referrer at signup. One row per user, first touch wins. Android only — an absent row means unattributable, NOT organic.';

create table if not exists public.ad_spend_daily (
  network text not null check (network in ('snap', 'meta')),
  date date not null,
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
  account_timezone text,
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
  'Daily FX rates for reporting ad spend in a currency other than the ad account''s. 1 unit of `base` = `rate` units of `quote`.';;
