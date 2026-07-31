-- Issue reports: one row per "Report issue" press from inside the app
-- (POST /api/verified-vibe/report-issue). Two independent channels, same as
-- job_applications: the endpoint emails the team AND writes this row, so a Resend
-- outage can never silently lose a safety report.
--
-- This is DELIBERATELY separate from verified_vibe_reports. That table is
-- "I am reporting this person" and feeds moderation of a user. This one is
-- "something on my screen is wrong" — a photo that should never have passed the
-- content screen, a broken surface, wrong AI behaviour — and the subject may be
-- nobody at all. Collapsing them would make the safety queue unreadable.

CREATE TABLE IF NOT EXISTS issue_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id       UUID,                            -- who pressed it (null if unauthenticated)
  category          TEXT NOT NULL,                   -- nudity | disturbing | wrong_person | bug | other
  surface           TEXT NOT NULL DEFAULT '',        -- where they were (e.g. discover, profile, chat)
  description       TEXT,                            -- optional free text, capped by the endpoint
  subject_user_id   UUID,                            -- the profile being viewed, when there is one
  subject_url       TEXT,                            -- the specific image/page complained about
  context           JSONB NOT NULL DEFAULT '{}',     -- whatever the client could tell us (match id, photo index…)
  status            TEXT NOT NULL DEFAULT 'pending', -- pending | reviewing | actioned | dismissed
  email_sent        BOOLEAN NOT NULL DEFAULT FALSE,  -- did the notification email deliver?
  created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- The triage queue reads newest-first; the per-subject index answers "has anyone
-- else flagged this profile", which is what decides whether to pull it.
CREATE INDEX IF NOT EXISTS idx_issue_reports_created ON issue_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issue_reports_status  ON issue_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issue_reports_subject ON issue_reports (subject_user_id, created_at DESC);

-- Server-only table: written and read by the service role. No end-user access —
-- a reporter must never be able to read (or enumerate) other people's reports.
ALTER TABLE issue_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_issue_reports" ON issue_reports;
CREATE POLICY "service_role_all_issue_reports"
  ON issue_reports FOR ALL TO service_role USING (true) WITH CHECK (true);
