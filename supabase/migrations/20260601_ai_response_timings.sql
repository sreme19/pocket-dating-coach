-- AI response latency tracking.
--
-- One row per AI (e.g. Bestie) reply, keyed by the reply message id. The server
-- fills the generation columns when it produces the reply; the recipient's
-- client fills the delivery/render columns once the message paints. Powers the
-- "AI Latency" tab in the admin analytics dashboard.

create table if not exists vv_ai_response_timings (
  id                       uuid primary key default gen_random_uuid(),
  reply_message_id         uuid unique,                 -- join key (the AI reply message)
  match_id                 uuid,
  response_type            text not null default 'bestie',

  -- server stage (set in bestie-responder.ts when the reply is generated)
  trigger_message_id       uuid,
  trigger_at               timestamptz,                 -- when the user's message hit the DB
  generated_at             timestamptz,                 -- when the AI reply was stored
  generation_ms            integer,                     -- full server cost (reads + Claude + write)
  claude_ms                integer,                     -- Claude API call only
  waited_from_user_msg_ms  integer,                     -- trigger_at -> generated_at

  -- client stage (set via /api/verified-vibe/analytics/ai-render after paint)
  received_at              timestamptz,                 -- poll first surfaced it
  rendered_at              timestamptz,                 -- painted on screen
  surface_ms               integer,                     -- generated_at -> received_at (poll gap)
  render_ms                integer,                     -- received_at -> rendered_at
  total_to_render_ms       integer,                     -- generated_at -> rendered_at

  created_at               timestamptz not null default now()
);

create index if not exists vv_ai_timings_created_idx on vv_ai_response_timings (created_at desc);

-- Admin dashboard reads via the service role; no public access.
alter table vv_ai_response_timings enable row level security;
