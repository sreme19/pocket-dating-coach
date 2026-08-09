-- Where a member came from, kept next to the member.
--
-- THE PROBLEM THIS FIXES. Every stage of the journey after the install — signup,
-- onboarding, verification, matchability, first message, retention — is recorded
-- somewhere, and none of it carries a campaign. So the question the money
-- actually depends on, "which advert produced members rather than installs?",
-- could not be asked in SQL at all. Not slowly, not approximately: the column
-- did not exist.
--
-- The attribution was arriving and being thrown away. Play hands the install
-- referrer to the app, the landing pages put their utm_* in it, and
-- captureInstallReferrer read that string, pulled `ra_claim` out of it, and
-- returned early when there wasn't one — discarding the campaign that was
-- sitting in the same query string. /get never sends `ra_claim`, so for all paid
-- /get traffic the attribution was read and dropped on every single install.
--
-- ONE ROW PER MEMBER, FIRST TOUCH WINS. user_id is the primary key and the
-- endpoint inserts with ignoreDuplicates, so a retry — or a reinstall months
-- later carrying a newer referrer — cannot rewrite history and quietly move a
-- member from the campaign that actually recruited them to a more recent one.
--
-- ANDROID ONLY, AND THE DASHBOARD MUST SAY SO. iOS has no install referrer;
-- there is no Apple equivalent to read. An iOS member therefore has no row here,
-- which has to render as "not attributable" and never as "organic" — the two
-- look identical in a group-by and mean opposite things.

create table if not exists public.user_acquisition (
  -- Not a surrogate id: one attribution per member, enforced by the shape.
  user_id uuid primary key references auth.users(id) on delete cascade,

  -- The utm_* broken out, because every report groups by these and digging
  -- them out of jsonb in each query is how two charts end up disagreeing about
  -- what "campaign" meant.
  network text,        -- utm_source
  medium text,         -- utm_medium
  campaign text,       -- utm_campaign
  ad_set text,         -- utm_term
  creative text,       -- utm_content

  -- The whole thing as it arrived, for anything the columns above did not
  -- anticipate. Cheap to keep and impossible to reconstruct later.
  utm jsonb not null default '{}'::jsonb,
  referrer_raw text,

  -- Which landing page sent them, carried through the install in `ra_lp`.
  -- Not derivable from the campaign: each page has its own DEFAULT campaign
  -- label, but an ad supplying its own utm_campaign overrides both.
  landing_page text,

  -- The /aibestie conversation code, when there was one. Lets an install be
  -- tied to the specific pre-install conversation that produced it.
  claim_code text,

  platform text check (platform in ('android', 'ios')),

  -- When the DEVICE read the referrer, which is the install moment. created_at
  -- is when the row reached us, and the two differ by however long it took the
  -- member to finish signing up — sometimes days.
  captured_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_acquisition_campaign_idx
  on public.user_acquisition (campaign, created_at desc);

create index if not exists user_acquisition_landing_page_idx
  on public.user_acquisition (landing_page, created_at desc);

create index if not exists user_acquisition_created_at_idx
  on public.user_acquisition (created_at desc);

-- Written by the service role from /api/attribution/install and read by admin
-- tooling only. A member has no reason to read, and certainly no reason to
-- write, the record of which advert they cost money on.
alter table public.user_acquisition enable row level security;

comment on table public.user_acquisition is
  'Which campaign, creative and landing page produced each member. Populated from the Play install referrer at signup. One row per user, first touch wins. Android only — an absent row means unattributable, NOT organic.';
