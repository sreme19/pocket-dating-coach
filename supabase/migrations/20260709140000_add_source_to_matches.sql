-- Match provenance (2026-07-09). Records HOW a match was created so behaviors can
-- be gated on it — specifically the 24h hand-off auto-unmatch, which applies to
-- Matchmaker-AI matches only (a woman who noticed/was admired already chose to
-- engage, so those matches must never be auto-unmatched).
--
--   'matchmaker' → created by the Matchmaker AI (batch or on-demand).
--   'notice_me'  → created via the attention flow ("notice me" / "admire").
--   NULL         → legacy/unknown. Treated as NOT matchmaker (never auto-unmatched).
--
-- Left nullable with no CHECK so a missing tag can never break match creation.
ALTER TABLE verified_vibe_matches
  ADD COLUMN IF NOT EXISTS source text;

COMMENT ON COLUMN verified_vibe_matches.source IS
  'How the match was created: matchmaker | notice_me (NULL = legacy/unknown, treated as not-matchmaker). Gates matchmaker-only behaviors like the 24h hand-off auto-unmatch.';
