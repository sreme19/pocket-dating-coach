-- Soft-delete + data retention for account deletion.
ALTER TABLE verified_vibe_users
ADD COLUMN IF NOT EXISTS deleted_at      TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deletion_reason TEXT,
ADD COLUMN IF NOT EXISTS anonymized_at   TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS research_id     UUID;

COMMENT ON COLUMN verified_vibe_users.deleted_at IS
'When the user soft-deleted their account. NULL = active. Soft-deleted rows are hidden from pool/discover/match and the login is banned, but data is retained.';

COMMENT ON COLUMN verified_vibe_users.deletion_reason IS
'Canned churn reason code captured at deletion (mirrors account_deletions.reason).';

COMMENT ON COLUMN verified_vibe_users.anonymized_at IS
'When the day-90 job stripped direct identifiers and purged photos. NULL = not yet anonymized.';

COMMENT ON COLUMN verified_vibe_users.research_id IS
'Random pseudonymous id assigned at anonymization; retained rows are re-keyed to this so data is no longer directly identifiable.';

-- Query-guard index: pool/discover/match reads filter `deleted_at IS NULL`.
CREATE INDEX IF NOT EXISTS idx_vv_users_active
ON verified_vibe_users (id)
WHERE deleted_at IS NULL;

-- Day-90 job index: find soft-deleted rows past the retention window not yet anonymized.
CREATE INDEX IF NOT EXISTS idx_vv_users_pending_anon
ON verified_vibe_users (deleted_at)
WHERE deleted_at IS NOT NULL AND anonymized_at IS NULL;;
