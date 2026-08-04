-- Networking-return notice: one per thread, enforced by the database.
--
-- notifyReturnToDate() guarded against a double-announce by SELECTing for an
-- existing notice and skipping if it found one. Two concurrent calls both run that
-- SELECT before either INSERTs, so both see nothing and both write. A woman's
-- thread ended up with the identical "come out of her networking season" line twice.
--
-- A read-then-write check cannot fix this from application code; the guard has to
-- live where the write happens. This partial unique index makes the second INSERT
-- fail instead of succeeding, and the caller treats a duplicate-key error as
-- "already sent" — which is exactly what it means.
--
-- Scoped to the notice itself via the content prefix, so it constrains nothing else
-- in verified_vibe_messages. The prefix is RETURN_NOTICE_PREFIX in
-- src/lib/server/networking-return.ts and the two must stay in step.

CREATE UNIQUE INDEX IF NOT EXISTS verified_vibe_messages_one_networking_return_per_match
  ON public.verified_vibe_messages (match_id)
  WHERE is_ai = true AND content LIKE 'Quick update —%networking season%';

COMMENT ON INDEX public.verified_vibe_messages_one_networking_return_per_match IS
  'At most one networking-return notice per match. Replaces a read-then-write check in notifyReturnToDate() that two concurrent calls could both pass.';
