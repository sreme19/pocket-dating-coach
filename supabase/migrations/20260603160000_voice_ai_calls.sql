-- ============================================================================
-- Voice AI — bestie voice calls + per-user voice identity
-- Created: 2026-06-03  (feature branch: voiceAI)
--
-- Lets a male match request a live voice call with the female owner's AI Bestie.
-- The bestie speaks either in a premium default voice or — if she opted in and
-- cloned her voice — in her own cloned voice (ElevenLabs). The live call runs on
-- an off-Vercel LiveKit agent worker; this schema tracks identity + call records.
-- Service-role-only access, matching the rest of the verified_vibe_* tables.
-- ============================================================================

-- ── 1. Per-user voice identity (the female owner's clone + call opt-in) ──────
CREATE TABLE IF NOT EXISTS vv_voice_profiles (
  user_id              UUID PRIMARY KEY REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  -- Lifecycle of her cloned voice. 'none' = never started; she still gets calls
  -- in the default premium voice. 'cloned' = elevenlabs_voice_id is usable.
  voice_status         TEXT NOT NULL DEFAULT 'none'
                         CHECK (voice_status IN ('none','sample_uploaded','cloning','cloned','failed')),
  elevenlabs_voice_id  TEXT,                 -- usable only when voice_status='cloned'
  sample_url           TEXT,                 -- Supabase Storage path of her consented sample
  -- She must explicitly consent before we clone her voice, and explicitly opt in
  -- before her bestie will ever accept a call. Two distinct consents on purpose.
  clone_consent_at     TIMESTAMPTZ,
  calls_opt_in         BOOLEAN NOT NULL DEFAULT FALSE,
  failure_reason       TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE vv_voice_profiles ENABLE ROW LEVEL SECURITY;

-- ── 2. Voice call records (one row per call attempt) ─────────────────────────
CREATE TABLE IF NOT EXISTS vv_voice_calls (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id           UUID NOT NULL REFERENCES verified_vibe_matches(id) ON DELETE CASCADE,
  -- The female owner the bestie speaks for, and the male match being called.
  owner_user_id      UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  caller_user_id     UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  channel            TEXT NOT NULL DEFAULT 'webrtc' CHECK (channel IN ('webrtc','pstn')),
  status             TEXT NOT NULL DEFAULT 'ringing'
                       CHECK (status IN ('ringing','live','completed','partial','failed','no_answer','cancelled')),
  -- LiveKit room the media flows through + the cloned/default voice actually used.
  livekit_room       TEXT NOT NULL,
  voice_id_used      TEXT,
  used_cloned_voice  BOOLEAN NOT NULL DEFAULT FALSE,
  -- Consent + disclosure trail.
  caller_consent_at  TIMESTAMPTZ,           -- male agreed to the AI call + recording notice
  disclosure_played  BOOLEAN NOT NULL DEFAULT FALSE,
  -- Conversation record. transcript = [{ role:'agent'|'caller', text, ts }].
  transcript         JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- draft_message tool output: [{ text, ts }] the owner can review/send later.
  drafts             JSONB NOT NULL DEFAULT '[]'::jsonb,
  recording_url      TEXT,                  -- null in phase 1 (transcript-only)
  duration_s         INTEGER,
  -- The bestie message dropped back into the thread after the call.
  summary_message_id UUID REFERENCES verified_vibe_messages(id) ON DELETE SET NULL,
  failure_reason     TEXT,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  connected_at       TIMESTAMPTZ,
  ended_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_vv_voice_calls_match ON vv_voice_calls(match_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_vv_voice_calls_caller ON vv_voice_calls(caller_user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_vv_voice_calls_status ON vv_voice_calls(status) WHERE status IN ('ringing','live');

ALTER TABLE vv_voice_calls ENABLE ROW LEVEL SECURITY;

-- ── 3. Reuse the AI latency dashboard for voice ──────────────────────────────
-- vv_ai_response_timings already keys by response_type; voice summaries record
-- as response_type='voice_summary' from the finalize endpoint. No schema change
-- needed here — documented so the latency tab can filter for it.
