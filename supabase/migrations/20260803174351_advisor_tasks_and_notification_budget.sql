-- ── 1. Async advisor work ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS advisor_tasks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assistant_type    TEXT NOT NULL CHECK (assistant_type IN ('wingman', 'bestie')),
  kind              TEXT NOT NULL
                    CHECK (kind IN ('match_scan', 'profile_audit', 'photo_audit', 'competitive_scan')),
  request_text      TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued', 'running', 'ready', 'failed', 'cancelled')),
  progress_note     TEXT,
  result_summary    TEXT,
  payload           JSONB,
  ack_message_id    UUID REFERENCES advisor_messages(id) ON DELETE SET NULL,
  result_message_id UUID REFERENCES advisor_messages(id) ON DELETE SET NULL,
  attempts          INTEGER NOT NULL DEFAULT 0,
  error             TEXT,
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_advisor_tasks_sweep
  ON advisor_tasks (status, requested_at)
  WHERE status IN ('queued', 'running');

CREATE INDEX IF NOT EXISTS idx_advisor_tasks_user
  ON advisor_tasks (user_id, assistant_type, requested_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_advisor_tasks_one_inflight
  ON advisor_tasks (user_id, kind)
  WHERE status IN ('queued', 'running');

-- Close the loop: add FK from advisor_messages.task_id → advisor_tasks.id
-- Null out any unresolvable task_ids first so the constraint never fails.
UPDATE advisor_messages m
  SET task_id = NULL
  WHERE m.task_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM advisor_tasks t WHERE t.id = m.task_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'advisor_messages_task_id_fkey'
  ) THEN
    ALTER TABLE advisor_messages
      ADD CONSTRAINT advisor_messages_task_id_fkey
      FOREIGN KEY (task_id) REFERENCES advisor_tasks(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── 2. Notification preferences ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_prefs (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  advisor_push  BOOLEAN NOT NULL DEFAULT TRUE,
  quiet_start   SMALLINT NOT NULL DEFAULT 22 CHECK (quiet_start BETWEEN 0 AND 23),
  quiet_end     SMALLINT NOT NULL DEFAULT 8  CHECK (quiet_end   BETWEEN 0 AND 23),
  timezone      TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. Notification log ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_log (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type      TEXT NOT NULL,
  channel   TEXT NOT NULL DEFAULT 'push' CHECK (channel IN ('push', 'email')),
  title     TEXT,
  sent_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_user_type
  ON notification_log (user_id, type, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_log_user_time
  ON notification_log (user_id, sent_at DESC);

-- ── 4. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE advisor_tasks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_notification_prefs" ON notification_prefs;
CREATE POLICY "users_own_notification_prefs" ON notification_prefs
  FOR ALL USING (auth.uid() = user_id);

COMMENT ON TABLE advisor_tasks IS
  'Async advisor work (pool scans, audits). Status lifecycle queued→running→ready|failed; completed_at set only on success. Swept by /api/cron/advisor-tasks.';
COMMENT ON INDEX idx_advisor_tasks_one_inflight IS
  'Prevents a user queueing the same kind of task twice — repeated taps join the in-flight run instead of spawning another.';
COMMENT ON TABLE notification_prefs IS
  'Per-user quiet hours and proactive-push opt-out. Replaces the hardcoded façade at /verified-vibe/api/notification-preferences.';
COMMENT ON TABLE notification_log IS
  'Ledger of delivered notifications, enforcing the per-type daily cap.';;
