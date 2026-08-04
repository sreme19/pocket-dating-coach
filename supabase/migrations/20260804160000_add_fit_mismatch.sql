-- A hard mismatch Bestie found in conversation (G-2 / stage 1).
--
-- The matchmaker applies her hard filters BEFORE a match exists — age, city, gender,
-- intent as recorded at onboarding — so anything on the board has already cleared
-- them. What it cannot catch is a hard-no he reveals while talking: a man who says he
-- is not looking for a relationship to a woman whose dealbreaker is mixed signals.
-- Until now Bestie noted that privately and carried on to hand-off anyway, and the
-- woman was asked to step in for someone who had told us he wants something else.
--
-- Deliberately NOT an auto-close. Unmatching is hard to reverse and this is a model
-- judgement — the same model once accused a blameless man nine times of pushing a line
-- he never sent, and twice announced it was ending the thread. So this records the
-- mismatch, stops Bestie driving toward a hand-off, and puts the decision in front of
-- HER. She unmatches, or carries on anyway; both are hers to choose.
--
-- Shape: { "reason": "<his own words or a plain summary>", "at": "<iso>" }
-- NULL means no mismatch found, which is the overwhelming majority of matches.

ALTER TABLE public.verified_vibe_matches
  ADD COLUMN IF NOT EXISTS fit_mismatch JSONB;

COMMENT ON COLUMN public.verified_vibe_matches.fit_mismatch IS
  'Hard mismatch Bestie found in conversation (G-2): { reason, at }. Zeroes stage 1 of his gap bar, stops her driving toward hand-off, and surfaces the call to the female owner. NEVER auto-unmatches — it is a model judgement, so the decision stays with her. NULL = no mismatch.';
