create table if not exists aibestie_lp_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references verified_vibe_users(id) on delete cascade,
  owner_id uuid not null references verified_vibe_users(id) on delete cascade,
  match_id uuid not null references verified_vibe_matches(id) on delete cascade,
  ip_hash text,
  user_agent text,
  turns integer not null default 0,
  bar_percent numeric(5,2) not null default 0,
  claim_code text unique,
  claimed_by_user_id uuid references verified_vibe_users(id) on delete set null,
  claimed_at timestamptz,
  utm jsonb,
  first_message_at timestamptz,
  cta_shown_at timestamptz,
  cta_clicked_at timestamptz,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create index if not exists idx_aibestie_lp_sessions_ip on aibestie_lp_sessions (ip_hash, created_at desc);
create index if not exists idx_aibestie_lp_sessions_unclaimed on aibestie_lp_sessions (created_at) where claimed_at is null;
create index if not exists idx_aibestie_lp_sessions_user on aibestie_lp_sessions (user_id);;
