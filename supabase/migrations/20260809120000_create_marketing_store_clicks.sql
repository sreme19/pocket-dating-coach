-- First-party record of every tap on a /get CTA.
--
-- The point of this table is to answer "did someone tap the button?" without
-- asking an ad network. Both pixels hand their event to a queue that flushes on
-- a timer, and every CTA on that page navigates to Play immediately, so the
-- page can be destroyed before the flush — which is exactly why Custom event 1
-- read zero for a week while landing page views did not. A row here is written
-- by our own server from a keepalive request, so it survives the teardown, it
-- survives ad blockers, and it can be read in SQL a second later instead of in
-- someone's dashboard twenty minutes later.
--
-- It is also the dedup key: `event_id` is generated in the browser, sent to
-- Snap and Meta with the browser-side event AND with the server-side one, so
-- both networks collapse the pair into a single conversion rather than counting
-- the tap twice.
--
-- Deliberately no IP address column. The networks need client IP for match
-- quality and it is forwarded to them in memory, but there is no reason for us
-- to retain it: this page has no accounts, no login and no form, so a stored IP
-- would be the only thing here capable of identifying a person. User agent IS
-- stored, because whether the in-app browser inside Snapchat behaves
-- differently from Chrome is the entire open question this table exists to
-- settle.

create table if not exists public.marketing_store_clicks (
  id uuid primary key default gen_random_uuid(),

  -- Shared with the browser pixels so Snap and Meta can dedupe.
  event_id text not null unique,

  -- Which of the four CTAs, and the campaign that brought them. Same labels
  -- Play sees on the install referrer.
  cta text not null,
  campaign text,
  utm jsonb not null default '{}'::jsonb,

  -- Answers "does this fire inside Snapchat's in-app browser or only Chrome?"
  user_agent text,
  referrer text,

  -- Whether the server-side forward actually reached each network. Null means
  -- not attempted (no token configured), false means attempted and failed.
  snap_forwarded boolean,
  meta_forwarded boolean,
  forward_error text,

  created_at timestamptz not null default now()
);

create index if not exists marketing_store_clicks_created_at_idx
  on public.marketing_store_clicks (created_at desc);

create index if not exists marketing_store_clicks_campaign_idx
  on public.marketing_store_clicks (campaign, created_at desc);

-- Written only by the service role from /api/marketing/store-click, and read
-- only by admin tooling. No policies: RLS on with none defined denies every
-- anon and authenticated request, which is what we want for a table that
-- records visitors who are not users.
alter table public.marketing_store_clicks enable row level security;

comment on table public.marketing_store_clicks is
  'Server-side record of /get store-button taps. Written from a keepalive request so it survives the page unload that loses browser pixel events. event_id dedupes against the Snap/Meta browser pixels.';
