create or replace function get_auth_user_ids()
returns table(id uuid)
language sql
security definer
as $$
  select id from auth.users;
$$;
