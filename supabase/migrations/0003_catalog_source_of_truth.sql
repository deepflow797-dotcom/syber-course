-- Restore migration 0003: catalog tables become the ONLY source of truth
-- for products, collections and coupons (dashboard writes here, never to restore_state.data).
-- Run after 0002_relational.sql. Idempotent.
--
-- What changes:
--   * restore_products   : + sku, sort_order, extra (non-relational dashboard attributes:
--                          vendor, type, description{ar,fr}, includes, colors, colorImages,
--                          battery, warrantyMonths, collections[] ...). Relational columns
--                          (price, stock, active, handle, title, images, specs, condition, brand)
--                          remain authoritative and are what restore_create_order_v2 reads.
--   * restore_collections: + sort_order, extra
--   * restore_coupons    : + extra ; public may read ACTIVE coupons (same exposure as the old
--                          published JSON state) so the storefront can preview a discount.
--                          Final validation still happens in restore_create_order_v2.
--   * restore_catalog_meta: single row bumped on every catalog write so storefront tabs
--                          can detect changes without re-publishing restore_state.

alter table public.restore_products    add column if not exists sku text;
alter table public.restore_products    add column if not exists sort_order int not null default 0;
alter table public.restore_products    add column if not exists extra jsonb not null default '{}'::jsonb;
create index if not exists restore_products_sku_idx on public.restore_products (sku);

alter table public.restore_collections add column if not exists sort_order int not null default 0;
alter table public.restore_collections add column if not exists extra jsonb not null default '{}'::jsonb;

alter table public.restore_coupons     add column if not exists extra jsonb not null default '{}'::jsonb;

-- Storefront needs active coupons to preview discounts at checkout (order RPC re-validates).
drop policy if exists restore_coupons_public_read on public.restore_coupons;
create policy restore_coupons_public_read on public.restore_coupons
  for select to anon, authenticated using (active = true);
grant select on public.restore_coupons to anon, authenticated;

-- Change marker (storage only; no business logic).
create table if not exists public.restore_catalog_meta (
  id text primary key,
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.restore_catalog_meta (id) values ('main') on conflict (id) do nothing;
alter table public.restore_catalog_meta enable row level security;
drop policy if exists restore_catalog_meta_public_read on public.restore_catalog_meta;
create policy restore_catalog_meta_public_read on public.restore_catalog_meta
  for select to anon, authenticated using (true);
drop policy if exists restore_catalog_meta_staff_write on public.restore_catalog_meta;
create policy restore_catalog_meta_staff_write on public.restore_catalog_meta
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
grant select on public.restore_catalog_meta to anon, authenticated;
grant select, insert, update on public.restore_catalog_meta to authenticated;

-- Staff may read inactive products too (public policy only exposes active=true).
-- Already covered by restore_catalog_staff_products (for all ... using is_staff()).

-- Reporting helper (read-only view, no writes): products with their collection handles.
create or replace view public.restore_products_with_collections as
select p.*,
       coalesce((select jsonb_agg(c.handle order by cp.sort_order)
                 from public.restore_collection_products cp
                 join public.restore_collections c on c.id = cp.collection_id
                 where cp.product_id = p.id), '[]'::jsonb) as collection_handles
from public.restore_products p;
grant select on public.restore_products_with_collections to anon, authenticated;
