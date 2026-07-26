-- Private-mode referral links (2026-07-26) — the "Privately" tab on Refer & Earn.
--
-- A member now owns up to TWO links:
--   public  — the /beta landing shows their card (photo, name, age, city) and a
--             cross-gender joiner is auto-matched to them.
--   private — the landing shows nothing about them (generic brand copy, brand
--             logo in the link preview) and NO match is ever formed, in either
--             direction. Attribution and cash are identical to the public link:
--             same ledger, same tracks, same rates (women 100/150 cap 100, men
--             flat 25 cap 1000).
--
-- The mode is a property of the TOKEN rather than a query param on purpose. The
-- no-match rule is enforced days later, when the invitee finishes verification,
-- so it has to survive the link being forwarded, shortened or re-typed — a
-- strippable ?p=1 would fail OPEN (photo shown, match formed).

alter table verified_vibe_referral_links
  add column if not exists mode text not null default 'public'
  check (mode in ('public', 'private'));

-- One link per referrer PER MODE (was: one link per referrer, full-table unique).
-- Partial, because admin-level links carry referrer_id = null and are kept
-- unique by `kind` instead (see 20260724170511).
alter table verified_vibe_referral_links
  drop constraint if exists verified_vibe_referral_links_referrer_id_key;

create unique index if not exists verified_vibe_referral_links_referrer_mode_key
  on verified_vibe_referral_links (referrer_id, mode)
  where referrer_id is not null;

comment on column verified_vibe_referral_links.mode is
  'public = referrer card on the /beta landing + auto-match on join; private = nothing about the referrer is shown and no match is ever formed. Attribution and cash rewards are identical on both.';;
