-- Backfill (mobile): the mobile client created verified_vibe_users rows without
-- setting is_seed (fixed in api.dart saveGenderArchetype), so real mobile signups
-- after the 2026-05-30 backfill were left at the default is_seed = true and were
-- wrongly treated as seed/demo profiles (excluded from trust/matching cohorts).
--
-- Same safe rule as the original backfill: any row with a matching auth.users
-- entry is a real signup, since seed profiles are inserted directly via
-- migrations and have no auth.users row.
update verified_vibe_users
set is_seed = false
where is_seed = true
  and id in (select id from auth.users);
