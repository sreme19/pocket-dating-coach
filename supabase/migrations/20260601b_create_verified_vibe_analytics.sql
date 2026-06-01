-- Create the verified_vibe_analytics table.
--
-- This table is referenced throughout the app (like/pass/view/message event
-- logging, the admin Overview + User Activity tabs) and is declared in the
-- generated Database types, but it was never actually created in the database —
-- so every insert has been silently failing (PostgREST PGRST205) and the
-- dashboards' event counts have always read empty. This creates it to match the
-- shape the code already expects.

create table if not exists verified_vibe_analytics (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  event_type  text not null,
  profile_id  uuid,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists vv_analytics_user_idx    on verified_vibe_analytics (user_id);
create index if not exists vv_analytics_event_idx   on verified_vibe_analytics (event_type);
create index if not exists vv_analytics_created_idx on verified_vibe_analytics (created_at desc);

-- Written/read by the service role only (server-side getSupabase()).
alter table verified_vibe_analytics enable row level security;
