-- MonitorLog table — stores results from synthetic monitoring checks
-- (5-min health checks + daily AI credit probes).
-- Spec: TechSpec - Riteangle.docx §9

CREATE TABLE IF NOT EXISTS monitor_log (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  check_name       TEXT        NOT NULL,
  status           TEXT        NOT NULL CHECK (status IN ('OK', 'FAIL', 'WARN')),
  response_time_ms INTEGER,
  error_message    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for dashboard queries (latest N rows per check_name)
CREATE INDEX IF NOT EXISTS monitor_log_created_at_idx ON monitor_log (created_at DESC);
CREATE INDEX IF NOT EXISTS monitor_log_check_name_idx  ON monitor_log (check_name, created_at DESC);

-- RLS: only service-role can write; admin reads via service-role too (no public access)
ALTER TABLE monitor_log ENABLE ROW LEVEL SECURITY;
