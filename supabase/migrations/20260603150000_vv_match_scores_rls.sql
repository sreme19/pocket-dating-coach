-- Lock down vv_match_scores. It holds competitive intelligence (other users'
-- composites, Standings, checklists) and is ONLY ever read/written server-side
-- via the Supabase service role, which bypasses RLS. Enabling RLS with NO
-- policies therefore denies all anon/authenticated (client-key) access while
-- leaving server access untouched.

ALTER TABLE vv_match_scores ENABLE ROW LEVEL SECURITY;
