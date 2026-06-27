-- Mobile event log: records user actions, screen views, and client-side errors
-- from the Flutter mobile app. Errors also trigger email alerts via the
-- /api/mobile-error Vercel endpoint.

create table if not exists mobile_event_log (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        references auth.users(id) on delete set null,
  event_type    text        not null check (event_type in ('action', 'error', 'navigation')),
  screen        text,
  action        text,
  error_message text,
  error_type    text,
  metadata      jsonb,
  app_version   text,
  created_at    timestamptz not null default now()
);

create index if not exists mobile_event_log_user_id_idx    on mobile_event_log (user_id);
create index if not exists mobile_event_log_event_type_idx on mobile_event_log (event_type);
create index if not exists mobile_event_log_created_at_idx on mobile_event_log (created_at desc);
create index if not exists mobile_event_log_errors_idx     on mobile_event_log (event_type, created_at desc)
  where event_type = 'error';

alter table mobile_event_log enable row level security;

-- Authenticated users can insert their own events; unauthenticated (pre-login)
-- events are allowed with user_id = null.
create policy "mobile users insert own events"
  on mobile_event_log for insert
  with check (auth.uid() = user_id or user_id is null);

-- Only service role (server-side) can read logs.
create policy "service role reads all logs"
  on mobile_event_log for select
  using (auth.role() = 'service_role');
