create table if not exists public.marketing_store_clicks (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  cta text not null,
  campaign text,
  utm jsonb not null default '{}'::jsonb,
  user_agent text,
  referrer text,
  snap_forwarded boolean,
  meta_forwarded boolean,
  forward_error text,
  created_at timestamptz not null default now()
);

create index if not exists marketing_store_clicks_created_at_idx
  on public.marketing_store_clicks (created_at desc);

create index if not exists marketing_store_clicks_campaign_idx
  on public.marketing_store_clicks (campaign, created_at desc);

alter table public.marketing_store_clicks enable row level security;

comment on table public.marketing_store_clicks is
  'Server-side record of /get store-button taps. Written from a keepalive request so it survives the page unload that loses browser pixel events. event_id dedupes against the Snap/Meta browser pixels.';;
