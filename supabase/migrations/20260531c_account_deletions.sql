-- Account deletion feedback log (churn record).
-- One row per in-app account deletion. Captures the user's stated reason for
-- leaving plus optional free-text feedback, written immediately BEFORE the user
-- profile row and auth user are destroyed.
--
-- Deliberately NOT foreign-keyed to verified_vibe_users or auth.users: both of
-- those rows are deleted moments after this insert, and the churn record must
-- survive them. The IDs are stored as plain UUIDs for later analysis only.

CREATE TABLE IF NOT EXISTS account_deletions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id     UUID NOT NULL,
  reason           TEXT,              -- one of the canned reason codes (or null if skipped)
  feedback         TEXT,              -- optional free-text "anything we could have done better"
  archetype        TEXT,              -- snapshot of the profile archetype at deletion time
  trust_score      INTEGER,           -- snapshot of trust score at deletion time
  account_age_days INTEGER,           -- days between signup and deletion
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_deletions_reason  ON account_deletions(reason);
CREATE INDEX IF NOT EXISTS idx_account_deletions_created ON account_deletions(created_at);

-- Written exclusively via the service-role key in the account-deletion endpoint,
-- so RLS stays enabled with no public policy — locked to service role by default.
ALTER TABLE account_deletions ENABLE ROW LEVEL SECURITY;
