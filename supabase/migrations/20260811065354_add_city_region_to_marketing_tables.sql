-- Add city and region columns to marketing_page_views
alter table public.marketing_page_views
  add column if not exists city text,
  add column if not exists region text;

-- Add city and region columns to marketing_store_clicks
alter table public.marketing_store_clicks
  add column if not exists city text,
  add column if not exists region text;

-- Create index on marketing_page_views
create index if not exists marketing_page_views_city_idx
  on public.marketing_page_views (city, created_at desc);

-- Create index on marketing_store_clicks
create index if not exists marketing_store_clicks_city_idx
  on public.marketing_store_clicks (city, created_at desc);;
