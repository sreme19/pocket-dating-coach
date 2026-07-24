-- Job applications: one row per submission from the public careers form
-- (/careers/[slug] -> POST /api/careers/apply). The endpoint emails each
-- application to the careers inbox AND writes it here, so a Resend outage can
-- never silently lose an applicant. The optional resume file is stored in the
-- private `job-applications` bucket (resume_path); the row keeps the contact
-- details and cover note.

CREATE TABLE IF NOT EXISTS job_applications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_slug       TEXT NOT NULL DEFAULT '',      -- OPEN_ROLES slug (e.g. marketing-associate-indonesia)
  role_title      TEXT NOT NULL DEFAULT '',      -- human title at time of applying
  name            TEXT NOT NULL,
  phone           TEXT NOT NULL,
  email           TEXT,                           -- optional; used as reply-to
  cover           TEXT,                           -- optional cover note
  resume_filename TEXT,                           -- original file name (null when no resume)
  resume_path     TEXT,                           -- path in the private `job-applications` bucket (null when no resume / upload failed)
  resume_mime     TEXT,
  resume_size     INTEGER,
  email_sent      BOOLEAN NOT NULL DEFAULT FALSE, -- did the notification email deliver?
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_applications_created ON job_applications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_applications_role    ON job_applications (role_slug, created_at DESC);

-- Server-only table: written and read by the service role. No end-user access.
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_job_applications" ON job_applications;
CREATE POLICY "service_role_all_job_applications"
  ON job_applications FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Private bucket for the optional resume files.
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-applications', 'job-applications', false)
ON CONFLICT (id) DO NOTHING;
