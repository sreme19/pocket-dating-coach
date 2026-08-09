-- First-party record of every arrival on a paid landing page.
--
-- marketing_store_clicks answers "did someone tap the button?". This answers
-- "out of how many?" — which we could not answer at all, because /get and
-- /get-photos have no server load and write nothing on arrival. The only record
-- of a landing page view lives inside Snap's and Meta's dashboards, so tap rate
-- — the single most important number on the page — could not be computed from
-- our own data. A rate whose denominator only a vendor holds is a rate you
-- cannot audit, and the whole reason marketing_store_clicks exists is that the
-- vendors were, in fact, wrong for a week.
--
-- `visit_id` is the point of the design. It is minted once per browsing session
-- and sent with BOTH the view and any subsequent store click, so tap rate is a
-- join over visits rather than two independent counts divided by each other.
-- That distinction matters: aggregate division cannot tell you whether 100 views
-- and 10 taps were 10 keen visitors or 10 different ones, it breaks entirely
-- when the two tables have different retention, and it can quietly exceed 100%
-- when a visitor reloads. It also makes the interesting question answerable —
-- which visits converted, and what did they have in common.
--
-- Same privacy posture as the clicks table, deliberately: utm, user agent and
-- referrer, and NO IP address. See the note in the store-clicks migration; the
-- reasoning is unchanged and applies with more force here, because arrivals are
-- far more numerous than taps.
--
-- `country` is the one thing added on both tables. It comes from the edge
-- header, which is derived from the IP without us ever storing the IP — the
-- privacy-preserving half of geolocation. Without it there is no way to tell an
-- expensive market from a cheap one, which is most of what paid-social spend
-- allocation actually consists of.

create table if not exists public.marketing_page_views (
  id uuid primary key default gen_random_uuid(),

  -- One per browsing session, minted in the browser. Shared with any store
  -- click from the same session so the two tables join.
  visit_id text not null,

  -- Which landing page. /get-photos previously recorded nothing at all, so it
  -- read as a failed variant rather than an unmeasured one.
  page text not null check (page in ('get', 'get_photos', 'aibestie')),

  campaign text,
  utm jsonb not null default '{}'::jsonb,

  user_agent text,
  referrer text,

  -- Two-letter ISO code from the edge. Never the IP it was derived from.
  country text,

  created_at timestamptz not null default now()
);

-- One row per visit per page. A reload inside the same session must not inflate
-- the denominator, which is exactly how a tap rate ends up above 100%.
create unique index if not exists marketing_page_views_visit_page_idx
  on public.marketing_page_views (visit_id, page);

create index if not exists marketing_page_views_created_at_idx
  on public.marketing_page_views (created_at desc);

create index if not exists marketing_page_views_campaign_idx
  on public.marketing_page_views (campaign, created_at desc);

alter table public.marketing_page_views enable row level security;

comment on table public.marketing_page_views is
  'First-party landing page arrivals. The denominator for store-tap rate, which previously existed only inside Snap and Meta. Joins to marketing_store_clicks on visit_id.';


-- The clicks table gains the same columns so a click can be attributed to a
-- visit, a country and a landing page. `visit_id` and `country` are nullable:
-- every row written before this migration has neither, and back-filling them is
-- not possible from data we chose not to keep. Charts must therefore treat null
-- as "unknown", never as zero.
alter table public.marketing_store_clicks
  add column if not exists visit_id text,
  add column if not exists country text,
  add column if not exists page text;

-- `page` CAN be back-filled honestly: /get was the only instrumented landing
-- page until today, so every existing row is one of its taps.
update public.marketing_store_clicks set page = 'get' where page is null;

create index if not exists marketing_store_clicks_visit_idx
  on public.marketing_store_clicks (visit_id);

create index if not exists marketing_store_clicks_page_idx
  on public.marketing_store_clicks (page, created_at desc);

comment on column public.marketing_store_clicks.visit_id is
  'Joins this tap to its marketing_page_views row. Null for taps recorded before 2026-08-09.';

-- Without this, the only thing separating a /get tap from a /get-photos tap is
-- the default campaign label each page falls back to — which stops separating
-- them the moment an ad supplies its own utm_campaign, and the entire point of
-- /get-photos is being comparable against /get.
comment on column public.marketing_store_clicks.page is
  'Which landing page the tap happened on. Back-filled to ''get'' for rows predating /get-photos instrumentation.';
