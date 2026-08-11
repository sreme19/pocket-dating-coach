ALTER TABLE public.verified_vibe_matches
  ADD COLUMN IF NOT EXISTS fit_mismatch JSONB;

COMMENT ON COLUMN public.verified_vibe_matches.fit_mismatch IS
  'Hard mismatch Bestie found in conversation (G-2): { reason, at }. Zeroes stage 1 of his gap bar, stops her driving toward hand-off, and surfaces the call to the female owner. NEVER auto-unmatches — it is a model judgement, so the decision stays with her. NULL = no mismatch.';;
