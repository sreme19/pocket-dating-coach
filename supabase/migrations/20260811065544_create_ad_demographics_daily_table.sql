-- Create ad_demographics_daily table for network demographic breakdowns
create table if not exists public.ad_demographics_daily (
  network text not null check (network in ('snap', 'meta')),
  date date not null,
  campaign_id text not null default '',
  campaign_name text,
  dimension text not null check (dimension in ('age','gender','age_gender','region','country','device','platform')),
  bucket text not null,
  spend numeric(18, 6) not null default 0,
  currency text not null,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  account_timezone text,
  fetched_at timestamptz not null default now(),
  source text not null default 'api' check (source in ('api', 'manual')),
  primary key (network, date, campaign_id, dimension, bucket)
);

-- Create indexes for efficient querying
create index if not exists ad_demographics_daily_date_idx
  on public.ad_demographics_daily (date desc);

create index if not exists ad_demographics_daily_dimension_idx
  on public.ad_demographics_daily (dimension, date desc);

-- Enable row level security
alter table public.ad_demographics_daily enable row level security;;
