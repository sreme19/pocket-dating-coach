-- "Ask him more" rounds spent on a match (G-27).
--
-- Its own column, deliberately NOT a field inside bestie_checklist. That JSON is
-- nulled on a re-vet, so a counter living there would silently refund her rounds
-- every time the checklist was rebuilt — and the whole point of the limit is that he
-- can trust there is an end to being asked things.
--
-- Counted at SEND, not on his reply: otherwise she could reopen the thread repeatedly
-- against a man who never answers and never spend a round doing it.
--
-- §K reactivation does NOT consume one. That re-vet is a different mechanism, and a
-- reactivated man should not arrive with her follow-ups already used up.

ALTER TABLE public.verified_vibe_matches
  ADD COLUMN IF NOT EXISTS bestie_question_rounds SMALLINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.verified_vibe_matches.bestie_question_rounds IS
  'Follow-up question rounds the female owner has spent on this match (0-2, G-27). Separate column because bestie_checklist is nulled on re-vet and would refund them. Incremented at send, not on his reply.';

-- Which round Bestie has already OPENED ON to him. Without this she would re-announce
-- "she came back with more she wants to know" on every turn of the round instead of
-- once, and would repeat the final-round warning until he stopped reading. Same shape
-- as bestie_consent_asked_at: a marker that a one-time thing has been said.
ALTER TABLE public.verified_vibe_matches
  ADD COLUMN IF NOT EXISTS bestie_round_announced SMALLINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.verified_vibe_matches.bestie_round_announced IS
  'Highest question round Bestie has already announced to him (G-27). Keeps the "she came back with more" opener and the final-round warning to one message each.';

-- Topics she wants checked with EVERY man, grown from her follow-up picks.
--
-- Deliberately not her `w` weights. Weights decide who she is matched with and how
-- every man ranks against her, so nudging them from a question she asked one person
-- would silently reshape her whole pool. This is a list of things to ask about, which
-- is what she actually chose.
ALTER TABLE public.verified_vibe_users
  ADD COLUMN IF NOT EXISTS always_ask_topics JSONB;

COMMENT ON COLUMN public.verified_vibe_users.always_ask_topics IS
  'Topics this owner wants every Bestie to cover, accumulated from her "ask him more" picks (G-27). Seeds future checklists. NOT a preference weight — it changes what is asked, never who she is matched with.';
