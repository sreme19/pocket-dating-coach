alter table public.ad_spend_daily
add column if not exists status text check (status is null or status in ('ACTIVE', 'PAUSED'));

comment on column public.ad_spend_daily.status is
'The network''s own admin-set status (ACTIVE/PAUSED) for the finest entity this row has an id for — ad set where one exists, campaign otherwise. NULL means not fetched, not "active".';;
