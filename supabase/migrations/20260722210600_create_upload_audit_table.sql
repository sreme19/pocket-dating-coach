-- Upload audit log: one row per file a user uploads to any capture surface
-- (proof-upload, verify-step, artifacts, car-image, profile photos). Lets
-- admins review what users submit and how the AI graded it. Sensitive
-- name-bearing docs (bank statements, gov-ID, vehicle RC, etc.) record
-- metadata + verdict only — their bytes are NEVER stored (bytes_stored=false).
-- Non-sensitive uploads keep their bytes in the private `upload-audit` bucket
-- (storage_path) or reference an already-public URL (existing_url).
-- Rows auto-expire after 90 days via the expire-uploads cron.

CREATE TABLE IF NOT EXISTS upload_audit (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID    REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  source        TEXT    NOT NULL,               -- proof-upload | verify-step | artifacts | car-image | profile-photo
  category      TEXT    NOT NULL DEFAULT '',    -- proof category / verify step / claim tag
  is_sensitive  BOOLEAN NOT NULL DEFAULT FALSE,
  bytes_stored  BOOLEAN NOT NULL DEFAULT FALSE,
  storage_path  TEXT,                           -- path in the private `upload-audit` bucket (null when not stored)
  existing_url  TEXT,                           -- public URL when the surface already persists the file elsewhere
  file_name     TEXT    NOT NULL DEFAULT '',
  mime_type     TEXT    NOT NULL DEFAULT '',
  size_bytes    INTEGER NOT NULL DEFAULT 0,
  verified      BOOLEAN,                         -- AI verdict when known
  ai_result     JSONB,                           -- snapshot of insights/reason/confidence/pts when known
  match_id      TEXT,                            -- chat-thread uploads: the match this fulfilled
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '90 days')
);

CREATE INDEX IF NOT EXISTS idx_upload_audit_user_created ON upload_audit (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_upload_audit_expires_at   ON upload_audit (expires_at);

-- Server-only table: written by the service role, read by the admin panel
-- (also service role). No end-user access.
ALTER TABLE upload_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_upload_audit" ON upload_audit;
CREATE POLICY "service_role_all_upload_audit"
  ON upload_audit FOR ALL TO service_role USING (true) WITH CHECK (true);;
