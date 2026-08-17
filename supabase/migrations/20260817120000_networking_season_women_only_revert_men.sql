-- Networking Season is now women-only (men's use of it was causing confusion
-- on the other side of chat). Revert the men currently sitting in networking
-- mode back to date, in both the source table and the matcher's pool mirror.
-- New writes are blocked server-side in /api/verified-vibe/discovery-mode.

update verified_vibe_users
set discovery_mode = 'date'
where gender = 'man' and discovery_mode = 'networking';

update vv_pool_profiles
set discovery_mode = 'date'
where discovery_mode = 'networking'
  and user_id in (select id from verified_vibe_users where gender = 'man');
