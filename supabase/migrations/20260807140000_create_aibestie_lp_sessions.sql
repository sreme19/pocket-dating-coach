-- /aibestie landing-page sessions.
--
-- One row per ad visitor. The provisional user, the match and the messages all
-- live in the normal tables (that reuse is the whole design), so this table holds
-- only what those tables have nowhere to put:
--
--   · the turn counter the 5-turn cap is enforced against. Derived counts are not
--     good enough — message rows include her opener and any system inserts, so
--     "count the messages" would cap him a turn early and differently per thread.
--   · the abuse signal. An unauthenticated page that triggers a Claude call per
--     message is an open invoice, and a turn cap is not abuse protection: a bot
--     simply starts N sessions. Rate limiting needs a per-origin creation count,
--     which is exactly what ip_hash + created_at give.
--   · the claim code, which is how a conversation survives the trip through the
--     Play Store. The install referrer carries one too, but it is readable once
--     and only if the install came from that click — a visible code is the
--     fallback that survives a manual store search and works on iOS.
--   · the funnel. Without per-stage timestamps a cheap install and a good one
--     look identical.
--
-- IP is stored HASHED. Rate limiting needs to recognise a repeat origin, which a
-- hash does; nothing here needs to know the address itself, and this row belongs
-- to someone who has not signed up to anything.

create table if not exists aibestie_lp_sessions (
  id                  uuid primary key default gen_random_uuid(),

  -- The provisional user minted for this visitor, and the thread they landed in.
  user_id             uuid not null references verified_vibe_users(id) on delete cascade,
  owner_id            uuid not null references verified_vibe_users(id) on delete cascade,
  match_id            uuid not null references verified_vibe_matches(id) on delete cascade,

  -- Salted hash, never the address. See AIBESTIE_IP_SALT.
  ip_hash             text,
  user_agent          text,

  -- HIS messages only — the definition of a turn. Enforced server-side; the
  -- client's count is a display detail and is never trusted.
  turns               integer not null default 0,

  -- What the LP bar last showed him. Seeded into
  -- verified_vibe_matches.gap_bar_percent at signup so the in-app bar starts
  -- where this one left off instead of dropping.
  bar_percent         numeric(5,2) not null default 0,

  -- Visible, short, and the fallback continuity path. Unique so a claim can
  -- resolve to exactly one session.
  claim_code          text unique,
  claimed_by_user_id  uuid references verified_vibe_users(id) on delete set null,
  claimed_at          timestamptz,

  -- Ad attribution, forwarded from the landing URL.
  utm                 jsonb,

  -- Funnel stages. Null until reached.
  first_message_at    timestamptz,
  cta_shown_at        timestamptz,
  cta_clicked_at      timestamptz,

  created_at          timestamptz not null default now(),
  last_active_at      timestamptz not null default now()
);

-- Rate limiting reads (ip_hash, created_at) together on every page load, so the
-- index carries both.
create index if not exists idx_aibestie_lp_sessions_ip
  on aibestie_lp_sessions (ip_hash, created_at desc);

-- The reaper sweeps unclaimed sessions by age.
create index if not exists idx_aibestie_lp_sessions_unclaimed
  on aibestie_lp_sessions (created_at)
  where claimed_at is null;

create index if not exists idx_aibestie_lp_sessions_user
  on aibestie_lp_sessions (user_id);

comment on table aibestie_lp_sessions is
  'One row per /aibestie ad landing-page visitor. Holds the authoritative turn count, the abuse signal, the claim code that carries a conversation through the Play Store, and the funnel timestamps. Unclaimed rows are purged after 30 days along with their provisional user.';

comment on column aibestie_lp_sessions.turns is
  'HIS messages only. The 5-turn cap is enforced against this, not against a message count, because message rows include the opener and system inserts.';

comment on column aibestie_lp_sessions.ip_hash is
  'Salted SHA-256 of the client IP (see AIBESTIE_IP_SALT). Rate limiting only needs to recognise a repeat origin, and this row belongs to someone who has not signed up.';
