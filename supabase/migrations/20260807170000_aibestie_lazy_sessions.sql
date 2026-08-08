-- /aibestie: don't write a person into the database until he says something.
--
-- The first cut created five rows on every ad click — a Supabase auth user with
-- a placeholder @lp.vv address, a profile, a match, her opening message and a
-- session row — before the visitor had typed a single character. Most paid
-- traffic bounces at the gate or after reading one message, so the overwhelming
-- majority of that was permanent débris, and the auth users were the worst of it:
-- fake addresses accumulating in the identity table for people who never engaged.
--
-- Two changes, both enabled by there being NO foreign key from
-- verified_vibe_users.id to auth.users (verified against the live database):
--
--  1. NOTHING but this session row is written until his FIRST MESSAGE. Page load
--     is now free. The row stays because rate limiting and bounce measurement
--     need something durable to key on, and one narrow row is a hundredth of what
--     was being written before.
--
--     It cannot be deferred further than the first message: generateBestieReply
--     reads the pair, the thread, her weights and his vectors by id from the real
--     tables, so she cannot answer him without them existing. Deferring to signup
--     would mean forking the responder — a second copy of the contact scrub, PII
--     compliance and hand-off rules, which is the one thing this design refuses.
--
--  2. NO AUTH USER, ever, until he actually signs up. The browser is
--     authenticated by an opaque token issued here instead of a Supabase JWT,
--     which is possible because /api/aibestie/* is the only thing it ever calls.
--     At signup he registers normally and the thread is re-pointed at his real
--     id, so there is no placeholder address to convert and no chance of
--     colliding with an account he already had.

-- The visitor's bearer token, stored as a hash. Same reasoning as any credential:
-- a leaked table should not hand over live sessions.
alter table aibestie_lp_sessions
  add column if not exists token_hash text;

create unique index if not exists idx_aibestie_lp_sessions_token
  on aibestie_lp_sessions (token_hash)
  where token_hash is not null;

-- These are now populated on the first message rather than at page load, so a
-- session legitimately exists without them.
alter table aibestie_lp_sessions alter column user_id  drop not null;
alter table aibestie_lp_sessions alter column match_id drop not null;

-- Distinguishes "opened the page and left" from "started talking" without having
-- to join anything — the single most useful number for judging ad creative.
alter table aibestie_lp_sessions
  add column if not exists materialized_at timestamptz;

comment on column aibestie_lp_sessions.token_hash is
  'SHA-256 of the opaque bearer token issued to the visitor. Replaces a Supabase auth user: no identity row exists until he signs up.';

comment on column aibestie_lp_sessions.materialized_at is
  'When his first message caused the profile, match and messages to be written. Null = he opened the page and never spoke, and cost one row.';
