-- One row per ad network recording its most recent spend sync run.
--
-- WHY THIS EXISTS. A sync that runs perfectly and finds nothing writes nothing,
-- so "the job is healthy, the campaigns are paused" and "the access token died"
-- left the database in an identical state: no recent rows in ad_spend_daily and
-- no trace that anything ran. The health check could not tell them apart and
-- reported a paused campaign as a broken pipeline, pointing at cron logs for an
-- API error that did not exist.
--
-- Recording the RUN rather than only its output fixes that. A successful run
-- returning zero rows is now recorded as exactly that.
--
-- ONE ROW PER NETWORK, upserted. The health check only ever asks about the most
-- recent run, and an append-only log would need pruning to stay cheap for a
-- question whose answer is always a single row.

create table if not exists ad_sync_runs (
  network       text primary key,
  ran_at        timestamptz not null default now(),
  window_start  date,
  window_end    date,
  -- Rows the network's API returned. Zero is a legitimate, healthy answer when
  -- nothing was delivered in the window — which is the whole point of the table.
  rows_returned integer not null default 0,
  -- The API error, verbatim, or null. Non-null is the one unambiguous signal
  -- that the pipeline itself is broken.
  error         text,
  configured    boolean not null default true
);

comment on table ad_sync_runs is
  'Most recent ad-spend sync per network. rows_returned = 0 with error = null means the sync worked and the campaigns spent nothing.';

-- Written and read by the service role only (server-side getSupabase()).
alter table ad_sync_runs enable row level security;
