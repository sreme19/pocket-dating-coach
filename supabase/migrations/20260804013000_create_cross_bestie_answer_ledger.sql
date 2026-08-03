-- Cross-conversation answer ledger + consent (Requirement §E, §Q).
--
-- The problem: a man in three Bestie threads answers the same questions three
-- times. Each woman's Bestie is hard-scoped to her own match — the transcript is
-- read `.eq('match_id')` and bestie_checklist is a column ON the match row — so
-- nothing he has already said is visible to the next Bestie.
--
-- §E allows the next Bestie to draw on his prior Bestie conversations WITH HIS
-- CONSENT. What it must NOT do is share transcripts: a Bestie message carries the
-- WOMAN's voice, her preferences and her checklist priorities, so handing thread
-- #3 the raw thread #1 would leak the woman in thread #1 — which §Q forbids.
--
-- Hence a ledger of HIS answers only, stored verbatim (his phrasing quotes back
-- warmer than a normalised fact), and carrying NO match id and NO partner id.
-- That omission is the source-hiding rule from §E clause 3 ("never reveal
-- references or sources") enforced by the schema rather than by prompt discipline
-- — a model cannot leak an attribution that was never stored.

-- ── Canonical topics ────────────────────────────────────────────────────────
-- The topic set GROWS out of what women's Bestie checklists actually probe: the
-- extractor maps each answer onto an existing key and proposes a new one when
-- nothing fits. It is a table rather than free text because matching has to be
-- exact — "wants kids eventually" and "does he want children" must resolve to one
-- key, or the ledger silently fails to suppress the duplicate question, which is
-- the whole point of the feature.
CREATE TABLE IF NOT EXISTS vv_ledger_topics (
  key         TEXT PRIMARY KEY,                    -- slug used by extractor + checklist mapping
  label       TEXT NOT NULL,                       -- human-readable, for the admin view
  origin      TEXT NOT NULL DEFAULT 'seed',        -- seed | checklist (where the topic came from)
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Seed set. Deliberately small — these are a starting point, not the intended
-- shape. Expect the checklist-derived topics to outnumber them over time.
INSERT INTO vv_ledger_topics (key, label, origin) VALUES
  ('career',     'Career and work',            'seed'),
  ('intentions', 'What he is looking for',     'seed'),
  ('kids',       'Kids and family plans',      'seed'),
  ('travel',     'Travel',                     'seed'),
  ('lifestyle',  'Lifestyle and how he lives', 'seed')
ON CONFLICT (key) DO NOTHING;

-- ── The ledger ──────────────────────────────────────────────────────────────
-- One row per gap-topic answer he has given, in his own words. Answers that do
-- NOT map to a topic are dropped, not stored: that is what keeps thread-specific
-- asides ("honestly I'm not sure about her, but…") structurally out of reach of
-- another woman's Bestie.
CREATE TABLE IF NOT EXISTS vv_answer_ledger (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,                       -- the man; NO match_id, NO partner_id, by design
  topic       TEXT NOT NULL REFERENCES vv_ledger_topics (key),
  answer      TEXT NOT NULL,                       -- verbatim, his phrasing
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Both reads are "what has this man said about this topic, most recent first":
-- the checklist generator asks it per candidate topic, the reply prompt asks it
-- for the topic in play. created_at rides in the index because staleness is a
-- first-class input — entries more than a few months old are reconfirmed rather
-- than assumed.
CREATE INDEX IF NOT EXISTS idx_vv_answer_ledger_user_topic
  ON vv_answer_ledger (user_id, topic, created_at DESC);

-- Server-only, both tables. A man must never be able to enumerate the ledger
-- directly — his own view of it is a Wingman summary, never raw rows.
ALTER TABLE vv_ledger_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE vv_answer_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_vv_ledger_topics" ON vv_ledger_topics;
CREATE POLICY "service_role_all_vv_ledger_topics"
  ON vv_ledger_topics FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_vv_answer_ledger" ON vv_answer_ledger;
CREATE POLICY "service_role_all_vv_answer_ledger"
  ON vv_answer_ledger FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Consent state (global, on the man) ──────────────────────────────────────
-- Global rather than per-match, and RETROACTIVE: a grant switches on every
-- Bestie including one he previously declined. The ask is framed as a general
-- "let Besties catch up", not a per-woman permission, so global is what he thinks
-- he is answering.
--
-- Consent gates REUSE only. Capture never stops — a declined man still builds a
-- ledger, it just stays unread, so a later grant is worth something immediately.
-- Revoking from Settings sets this back to 'declined' and LOCKS the rows; it does
-- not purge them, so re-granting restores full value.
ALTER TABLE verified_vibe_users
  ADD COLUMN IF NOT EXISTS ledger_consent TEXT NOT NULL DEFAULT 'unasked',
  ADD COLUMN IF NOT EXISTS ledger_declines INTEGER NOT NULL DEFAULT 0,
  -- Ask cadence after he has said no five times: ask on every 5th ASK
  -- OPPORTUNITY, not every 5th thread. An opportunity is a thread where her
  -- checklist actually overlaps his ledger — threads with no overlap never ask,
  -- so counting threads would nag men whose ledger was never relevant.
  ADD COLUMN IF NOT EXISTS ledger_opportunities_since_ask INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ledger_consent_at TIMESTAMP WITH TIME ZONE;

-- Guard the enum at the DB rather than trusting callers. Wrapped because
-- ADD CONSTRAINT has no IF NOT EXISTS and this migration must be re-runnable.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'verified_vibe_users_ledger_consent_check'
  ) THEN
    ALTER TABLE verified_vibe_users
      ADD CONSTRAINT verified_vibe_users_ledger_consent_check
      CHECK (ledger_consent IN ('unasked', 'granted', 'declined'));
  END IF;
END $$;

-- ── Per-thread ask marker ───────────────────────────────────────────────────
-- "One consent message per Bestie" needs each thread to remember whether SHE has
-- already asked.
--
-- This gets its own column and deliberately does NOT live inside bestie_checklist,
-- even though that JSON is already the per-match Bestie scratchpad: the checklist
-- is nulled outright on reactivation when her preferences change
-- (api/verified-vibe/ai-bestie/reactivate) and regenerated whenever missing
-- (bestie-responder), both by design. A marker stored there would be wiped on
-- either path and the same Bestie would ask him a second time in the same thread
-- — precisely the nagging the one-ask rule exists to prevent.
--
-- A timestamp rather than a boolean so "when did she ask" is answerable without
-- another column.
ALTER TABLE verified_vibe_matches
  ADD COLUMN IF NOT EXISTS bestie_consent_asked_at TIMESTAMP WITH TIME ZONE;
