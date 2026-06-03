-- ============================================================================
-- Voice AI — bestie voice calls + per-user voice identity
-- Created: 2026-06-03  (feature branch: voiceAI)
-- ============================================================================

-- ── 1. Per-user voice identity (the female owner's clone + call opt-in) ──────
CREATE TABLE IF NOT EXISTS vv_voice_profiles (
  user_id              UUID PRIMARY KEY REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  voice_status         TEXT NOT NULL DEFAULT 'none'
    CHECK (voice_status IN ('none','sample_uploaded','cloning','cloned','failed')),
  elevenlabs_voice_id  TEXT,
  sample_url           TEXT,
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
  owner_user_id      UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  caller_user_id     UUID NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  channel            TEXT NOT NULL DEFAULT 'webrtc' CHECK (channel IN ('webrtc','pstn')),
  status             TEXT NOT NULL DEFAULT 'ringing'
    CHECK (status IN ('ringing','live','completed','partial','failed','no_answer','cancelled')),
  livekit_room       TEXT NOT NULL,
  voice_id_used      TEXT,
  used_cloned_voice  BOOLEAN NOT NULL DEFAULT FALSE,
  caller_consent_at  TIMESTAMPTZ,
  disclosure_played  BOOLEAN NOT NULL DEFAULT FALSE,
  transcript         JSONB NOT NULL DEFAULT '[]'::jsonb,
  drafts             JSONB NOT NULL DEFAULT '[]'::jsonb,
  recording_url      TEXT,
  duration_s         INTEGER,
  summary_message_id UUID REFERENCES verified_vibe_messages(id) ON DELETE SET NULL,
  failure_reason     TEXT,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  connected_at       TIMESTAMPTZ,
  ended_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_vv_voice_calls_match  ON vv_voice_calls(match_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_vv_voice_calls_caller ON vv_voice_calls(caller_user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_vv_voice_calls_status ON vv_voice_calls(status) WHERE status IN ('ringing','live');

ALTER TABLE vv_voice_calls ENABLE ROW LEVEL SECURITY;;
