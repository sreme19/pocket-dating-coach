-- Documentation for the two tables added earlier today.
--
-- The DDL was applied through the Supabase MCP tooling, which synced back the
-- statements it ran and dropped the COMMENT ON clauses. Those comments are not
-- decoration here: two of them are the only place a rule lives that a reader can
-- otherwise violate while getting a plausible-looking number back. Restated as
-- their own migration rather than by editing the applied files, so what ran and
-- what is recorded as having run stay identical.
--
-- Pairs with 20260811065354_add_city_region_to_marketing_tables.sql and
-- 20260811065544_create_ad_demographics_daily_table.sql.

-- ── Geography on the landing-page tables ───────────────────────────────────
--
-- Null means UNKNOWN, never zero. Three separate causes, none of them "nobody
-- was there": the row predates 2026-08-11 and cannot be back-filled, the edge
-- could not resolve the address, or the city header is not available on this
-- plan. Charts must render these as their own category.

comment on column public.marketing_page_views.city is
  'Edge-resolved city, URL-decoded. Null for rows predating 2026-08-11, for addresses the edge could not resolve, and wherever the city header is not available. Never derived from a stored IP — nothing here stores one.';

comment on column public.marketing_page_views.region is
  'Edge-resolved first-level subdivision as the bare ISO 3166-2 code (KA, not IN-KA). Same null semantics as city.';

comment on column public.marketing_store_clicks.city is
  'Edge-resolved city, URL-decoded. Same null semantics as marketing_page_views.city.';

comment on column public.marketing_store_clicks.region is
  'Edge-resolved first-level subdivision as the bare ISO 3166-2 code. Same null semantics as marketing_page_views.region.';

-- ── Delivery demographics ──────────────────────────────────────────────────
--
-- THE LOAD-BEARING ONE. Spend in this table sums correctly WITHIN a dimension
-- and double counts ACROSS dimensions, because age and gender are two partitions
-- of the same money. A query that forgets to filter to one dimension returns a
-- total roughly N times the real spend and looks entirely reasonable doing it.
--
-- The second warning matters nearly as much: these describe impressions — who
-- the advert was SHOWN to — and are neither our landing-page visitors nor the
-- audience the ad set targeted. All three get conflated on sight.

comment on table public.ad_demographics_daily is
  'Network-reported delivery demographics per campaign-day. AGGREGATE BUCKETS ONLY — never per person, never joinable to a visit or a member. Describes who the advert was SHOWN to (impressions), not who visited, and not who was targeted. Spend sums to the campaign-day total WITHIN one dimension and double counts ACROSS dimensions.';

comment on column public.ad_demographics_daily.dimension is
  'Which partition of the campaign-day this row belongs to. Queries must filter to exactly one: age and gender are two partitions of the same money.';

comment on column public.ad_demographics_daily.bucket is
  'The network''s own label, stored verbatim. Snap''s and Meta''s bucket sets do not align and are deliberately not normalised into a shared vocabulary.';

comment on column public.ad_demographics_daily.spend is
  'In the ad account''s own currency, numeric rather than float — same treatment and same reason as ad_spend_daily.spend. Converted at display time via ad_fx_rates.';
