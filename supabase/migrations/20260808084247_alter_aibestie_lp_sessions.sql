alter table aibestie_lp_sessions add column if not exists token_hash text;
create unique index if not exists idx_aibestie_lp_sessions_token on aibestie_lp_sessions (token_hash) where token_hash is not null;
alter table aibestie_lp_sessions alter column user_id drop not null;
alter table aibestie_lp_sessions alter column match_id drop not null;
alter table aibestie_lp_sessions add column if not exists materialized_at timestamptz;;
