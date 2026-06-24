-- Add structured metadata column to monitor_log.
-- Enables app-side error tracking with feature/file/endpoint context.
ALTER TABLE monitor_log ADD COLUMN IF NOT EXISTS metadata JSONB;

CREATE INDEX IF NOT EXISTS monitor_log_metadata_check_name_idx
  ON monitor_log (check_name, created_at DESC)
  WHERE check_name = 'app_error';
