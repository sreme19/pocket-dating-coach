-- Enable RLS on tables flagged by Supabase Security Advisor as publicly accessible.
-- These tables are read/written exclusively via service-role key (admin dashboards,
-- CI/CD, server-side code). Enabling RLS with no user policies blocks all direct
-- anon/authenticated access while service-role bypasses RLS entirely.

-- Test suite tables (admin Test Suite only)
ALTER TABLE ts_runs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ts_pair_scores ENABLE ROW LEVEL SECURITY;

-- Per-match AI assistant config — only enable if the table exists in this env
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_assistant_match_configs') THEN
    ALTER TABLE ai_assistant_match_configs ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
