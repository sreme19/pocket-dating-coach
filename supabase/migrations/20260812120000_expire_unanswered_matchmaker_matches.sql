-- Retire the dead threads the nightly matcher over-produced (2026-08-12).
--
-- Until today the v2 matcher applied its caps to a single run rather than to a
-- person's inbox: it re-solved from a blank slate every night and handed out a
-- full cap on top of whatever was already there. Women sat at up to 21 active
-- matches against a cap of 12, men at 11 against a cap of 4, and each surplus
-- match arrived as a Bestie opener nobody answered. 67% of all matches ever
-- created hold exactly one message — that opener — and nothing else.
--
-- The cap fix (vector-matchmaker.ts) stops new ones being made, but it cannot
-- drain what is already there: with every woman at or over her cap the headroom
-- is zero, so no good new match can form until these are cleared.
--
-- 'expired' rather than a delete, deliberately. It is the reversible terminal
-- state the hand-off timeout already uses: both sides move the thread to their
-- Inactive section, the woman keeps a Reactivate button, thread history stays
-- intact, and unreactivated rows purge on the existing 30-day sweep. Nothing is
-- destroyed and she can pull any of these back.
--
-- Scope, deliberately conservative:
--   * only 'mutual' — never touches unmatched / blocked / already-expired rows
--   * only threads with NO human message ever, from either side
--   * only threads with at most one message total (the AI opener)
--   * only those older than 48h, so a match made last night keeps its chance
--
-- Expected: ~148 rows. Women go from avg 11.9 / max 21 to avg 3.4 / max 8;
-- men from 6.5 / 11 to 2.6 / 6 — everyone back inside their cap.
--
-- NOTE: this sets the state directly and so does NOT run the app's expiry
-- side-effects. That is intended — the normal flow hands the man a replacement
-- match, and 148 replacements would recreate the exact flood being cleaned up.

UPDATE verified_vibe_matches m
SET    status     = 'expired',
       expired_at = now()
WHERE  m.status = 'mutual'
  AND  m.created_at < now() - interval '48 hours'
  -- nobody ever said anything back
  AND  NOT EXISTS (
         SELECT 1 FROM verified_vibe_messages msg
         WHERE  msg.match_id = m.id
           AND  msg.is_ai IS NOT TRUE
       )
  -- at most the single Bestie opener
  AND  (SELECT count(*) FROM verified_vibe_messages msg WHERE msg.match_id = m.id) <= 1;

-- Verification — expect the flood gone and every inbox back inside its cap.
--
--   SELECT count(*) FILTER (WHERE status = 'mutual')  AS active,
--          count(*) FILTER (WHERE status = 'expired') AS expired
--   FROM   verified_vibe_matches;
--
--   SELECT u.gender, round(avg(c), 1) AS avg_inbox, max(c) AS max_inbox
--   FROM   verified_vibe_users u
--   JOIN   LATERAL (
--            SELECT count(*) AS c FROM verified_vibe_matches m
--            WHERE m.status = 'mutual' AND u.id IN (m.user1_id, m.user2_id)
--          ) x ON true
--   WHERE  u.deleted_at IS NULL
--   GROUP  BY u.gender;
