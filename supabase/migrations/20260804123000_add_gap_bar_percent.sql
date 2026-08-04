-- The man's gap-bar percentage, stored per match.
--
-- Its ONLY job is to make the bar monotonic. The bar is recomputed from his vectors
-- every time, so this column is not the source of truth for the number — it is the
-- FLOOR, so that a re-vet against her changed preferences (which legitimately moves
-- which dimensions stage 3 targets) can never make his number fall for something he
-- did not do. A bar that slides while he is typing turns the conversation into an
-- exam he can watch himself failing.
--
-- Display state only, exactly like bestie_checklist and proof_request. It must NEVER
-- be read back into trust or match scoring: the bar is computed FROM the scoring
-- vectors, so feeding it back would close a loop (trust → confidence → bar → trust)
-- and let scores drift with no new evidence entering the system.
--
-- Nullable with no default: NULL means "never computed", which the service reads as
-- "no floor yet" rather than as zero. That matters — defaulting to 0 would be
-- indistinguishable from a man who genuinely scored nothing.

ALTER TABLE public.verified_vibe_matches
  ADD COLUMN IF NOT EXISTS gap_bar_percent NUMERIC(4,1);

COMMENT ON COLUMN public.verified_vibe_matches.gap_bar_percent IS
  'Man-facing gap-bar percentage (0-100, one decimal). Monotonic floor for recomputation — display state only, never an input to trust or match scoring. NULL = never computed.';
