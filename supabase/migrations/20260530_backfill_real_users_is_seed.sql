-- Backfill: any user who signed up via the app (has an auth.users entry) but
-- was never explicitly marked as a seed should be treated as a real user.
-- Seed profiles are inserted directly via migrations and don't correspond to
-- auth.users rows, so joining on auth is a safe way to identify real signups.
update verified_vibe_users
set is_seed = false
where is_seed = true
  and id in (select id from auth.users);
