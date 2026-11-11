-- Restore migration 0002: relational catalog/orders/coupons (phase 3)
-- Run after schema.sql on a project being migrated to relational tables.
-- Notes:
-- * Keeps restore_state for settings/theme/navigation/hero/content refs.
-- * Products/orders gain relational sources of truth; use migration script for backfill.
-- * restore_create_order below is a DOCUMENTED ATOMICITY EXCEPTION: validation and
--   stock decrement run in one DB transaction because this project has no dedicated backend.

create table if not exists public.restore_categories (
  id text primary key,
  slug text unique not null,
  title jsonb not null default '{}'::jsonb, -- {ar,fr}
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.restore_collections (
  id text primary key,
  handle text unique not null,
  title jsonb not null default '{}'::jsonb,
  description jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.restore_products (
  id text primary key,
  handle text unique not null,
  title jsonb not null default '{}'::jsonb, -- {ar,fr}
  brand text,
  category_id text references public.restore_categories(id) on delete set null,
  price int not null check (price >= 0),
  compare_at int check (compare_at is null or compare_at >= 0),
  stock int not null default 0 check (stock >= 0),
  condition text,
  specs jsonb not null default '{}'::jsonb,
  images jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists restore_products_category_idx on public.restore_products(category_id);
create index if not exists restore_products_active_idx on public.restore_products(active);

create table if not exists public.restore_product_variants (
  id text primary key,
  product_id text not null references public.restore_products(id) on delete cascade,
  sku text unique,
  color text,
  storage text,
  price_delta int not null default 0,
  stock int not null default 0 check (stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists restore_product_variants_product_idx on public.restore_product_variants(product_id);

create table if not exists public.restore_collection_products (
  collection_id text not null references public.restore_collections(id) on delete cascade,
  product_id text not null references public.restore_products(id) on delete cascade,
  sort_order int not null default 0,
  primary key (collection_id, product_id)
);

create table if not exists public.restore_coupons (
  code text primary key,
  type text not null check (type in ('percent','fixed')),
  value int not null check (value >= 0),
  min_total int not null default 0 check (min_total >= 0),
  expires_at timestamptz,
  usage_limit int check (usage_limit is null or usage_limit >= 0),
  used_count int not null default 0 check (used_count >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Extend orders for relational reporting (keeps JSON data column for compatibility).
alter table public.restore_orders add column if not exists customer_name text;
alter table public.restore_orders add column if not exists phone text;
alter table public.restore_orders add column if not exists city text;
alter table public.restore_orders add column if not exists address text;
alter table public.restore_orders add column if not exists payment_method text;
alter table public.restore_orders add column if not exists subtotal int check (subtotal is null or subtotal >= 0);
alter table public.restore_orders add column if not exists shipping int check (shipping is null or shipping >= 0);
alter table public.restore_orders add column if not exists discount int check (discount is null or discount >= 0);
alter table public.restore_orders add column if not exists total int check (total is null or total >= 0);
alter table public.restore_orders add column if not exists coupon_code text;
alter table public.restore_orders add column if not exists validated boolean not null default false;
do $$ begin
  alter table public.restore_orders add constraint restore_orders_status_check
    check (status in ('new','confirmed','preparing','shipped','delivered','cancelled','returned'));
exception when duplicate_object then null; end $$;

create table if not exists public.restore_order_items (
  id text primary key,
  order_id text not null references public.restore_orders(id) on delete cascade,
  product_id text references public.restore_products(id) on delete set null,
  variant_id text references public.restore_product_variants(id) on delete set null,
  title_snapshot text,
  unit_price int not null check (unit_price >= 0),
  qty int not null check (qty > 0),
  line_total int not null check (line_total >= 0),
  created_at timestamptz not null default now()
);
create index if not exists restore_order_items_order_idx on public.restore_order_items(order_id);
create index if not exists restore_order_items_product_idx on public.restore_order_items(product_id);

-- updated_at triggers for new tables
do $$ begin
  if not exists (select 1 from pg_trigger where tgname='restore_categories_touch') then
    create trigger restore_categories_touch before update on public.restore_categories for each row execute function public.restore_set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname='restore_collections_touch') then
    create trigger restore_collections_touch before update on public.restore_collections for each row execute function public.restore_set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname='restore_products_touch') then
    create trigger restore_products_touch before update on public.restore_products for each row execute function public.restore_set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname='restore_product_variants_touch') then
    create trigger restore_product_variants_touch before update on public.restore_product_variants for each row execute function public.restore_set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname='restore_coupons_touch') then
    create trigger restore_coupons_touch before update on public.restore_coupons for each row execute function public.restore_set_updated_at();
  end if;
end $$;

-- RLS (staff manage catalog; public reads active catalog)
alter table public.restore_categories enable row level security;
alter table public.restore_collections enable row level security;
alter table public.restore_products enable row level security;
alter table public.restore_product_variants enable row level security;
alter table public.restore_collection_products enable row level security;
alter table public.restore_coupons enable row level security;
alter table public.restore_order_items enable row level security;

drop policy if exists restore_catalog_public_read_products on public.restore_products;
create policy restore_catalog_public_read_products on public.restore_products for select to anon, authenticated using (active = true);
drop policy if exists restore_catalog_public_read_variants on public.restore_product_variants;
create policy restore_catalog_public_read_variants on public.restore_product_variants for select to anon, authenticated using (true);
drop policy if exists restore_catalog_public_read_categories on public.restore_categories;
create policy restore_catalog_public_read_categories on public.restore_categories for select to anon, authenticated using (active = true);
drop policy if exists restore_catalog_public_read_collections on public.restore_collections;
create policy restore_catalog_public_read_collections on public.restore_collections for select to anon, authenticated using (active = true);
drop policy if exists restore_catalog_public_read_collection_products on public.restore_collection_products;
create policy restore_catalog_public_read_collection_products on public.restore_collection_products for select to anon, authenticated using (true);

drop policy if exists restore_catalog_staff_products on public.restore_products;
create policy restore_catalog_staff_products on public.restore_products for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists restore_catalog_staff_variants on public.restore_product_variants;
create policy restore_catalog_staff_variants on public.restore_product_variants for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists restore_catalog_staff_categories on public.restore_categories;
create policy restore_catalog_staff_categories on public.restore_categories for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists restore_catalog_staff_collections on public.restore_collections;
create policy restore_catalog_staff_collections on public.restore_collections for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists restore_catalog_staff_collection_products on public.restore_collection_products;
create policy restore_catalog_staff_collection_products on public.restore_collection_products for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists restore_catalog_staff_coupons on public.restore_coupons;
create policy restore_catalog_staff_coupons on public.restore_coupons for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists restore_order_items_staff on public.restore_order_items;
create policy restore_order_items_staff on public.restore_order_items for all to authenticated using (public.is_staff()) with check (public.is_staff());

grant select on public.restore_products, public.restore_product_variants, public.restore_categories, public.restore_collections, public.restore_collection_products to anon, authenticated;
grant select, insert, update, delete on public.restore_products, public.restore_product_variants, public.restore_categories, public.restore_collections, public.restore_collection_products, public.restore_coupons, public.restore_order_items to authenticated;

-- Read-only reporting views (staff RLS enforced via underlying tables when queried by staff; expose via staff role/policies as needed)
create or replace view public.restore_report_daily_sales as
select date_trunc('day', created_at)::date as day, count(*)::int as orders, coalesce(sum(total),0)::int as revenue
from public.restore_orders where status not in ('cancelled','returned')
group by 1 order by 1 desc;

create or replace view public.restore_report_top_products as
select oi.product_id, max(oi.title_snapshot) as title, sum(oi.qty)::int as units, sum(oi.line_total)::int as revenue
from public.restore_order_items oi join public.restore_orders o on o.id = oi.order_id
where o.status not in ('cancelled','returned')
group by oi.product_id order by revenue desc;

create or replace view public.restore_report_low_stock as
select id, handle, title, stock from public.restore_products where active = true and stock <= 3 order by stock asc, handle asc;

-- Atomic relational order creation (EXCEPTION: business validation in DB for atomicity without backend)
create or replace function public.restore_create_order_v2(p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_id text := coalesce(nullif(left(btrim(coalesce(p_order->>'id','')),120),''), 'RS-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)));
  v_item jsonb; v_p record; v_v record; v_qty int; v_unit int; v_line int; v_subtotal int := 0; v_shipping int := 0; v_discount int := 0; v_total int := 0;
  v_coupon record; v_coupon_discount int := 0; v_payment_discount int := 0; v_pay jsonb; v_settings jsonb; v_city_fee int := 0; v_items jsonb := '[]'::jsonb;
begin
  select data->'settings' into v_settings from public.restore_state where id='main';
  v_city_fee := 0;
  if jsonb_typeof(p_order->'items') <> 'array' or jsonb_array_length(p_order->'items') < 1 then raise exception 'Order items are required'; end if;
  for v_item in select * from jsonb_array_elements(p_order->'items') loop
    v_qty := greatest(1, least(20, coalesce((v_item->>'qty')::int,1)));
    select * into v_p from public.restore_products where handle = coalesce(v_item->>'handle','') and active = true for update;
    if not found then raise exception 'Unknown product: %', coalesce(v_item->>'handle',''); end if;
    v_unit := v_p.price;
    if nullif(coalesce(v_item->>'variantId',''),'') is not null then
      select * into v_v from public.restore_product_variants where id = v_item->>'variantId' and product_id = v_p.id for update;
      if found then v_unit := greatest(0, v_p.price + coalesce(v_v.price_delta,0)); end if;
    end if;
    if v_v.id is not null then
      if v_v.stock < v_qty then raise exception 'Insufficient stock: %', v_p.handle; end if;
      update public.restore_product_variants set stock = stock - v_qty, updated_at = v_now where id = v_v.id;
    else
      if v_p.stock < v_qty then raise exception 'Insufficient stock: %', v_p.handle; end if;
      update public.restore_products set stock = stock - v_qty, updated_at = v_now where id = v_p.id;
    end if;
    v_line := v_unit * v_qty; v_subtotal := v_subtotal + v_line;
    v_items := v_items || jsonb_build_array(jsonb_build_object('handle',v_p.handle,'productId',v_p.id,'variantId',v_v.id,'title',v_p.title,'unitPrice',v_unit,'qty',v_qty,'line',v_line));
  end loop;
  v_pay := coalesce(p_order->'payment','{}'::jsonb);
  v_payment_discount := round(v_subtotal * greatest(0, coalesce((v_pay->>'discount')::numeric,0)) / 100);
  if nullif(btrim(coalesce(p_order->>'coupon','')), '') is not null then
    select * into v_coupon from public.restore_coupons where upper(code)=upper(btrim(p_order->>'coupon')) and active=true for update;
    if found and (v_coupon.expires_at is null or v_coupon.expires_at >= v_now) and v_subtotal >= v_coupon.min_total and (v_coupon.usage_limit is null or v_coupon.used_count < v_coupon.usage_limit) then
      v_coupon_discount := case when v_coupon.type='percent' then round(v_subtotal * v_coupon.value / 100.0) else v_coupon.value end;
      update public.restore_coupons set used_count = used_count + 1, updated_at = v_now where code = v_coupon.code;
    else v_coupon := null; end if;
  end if;
  v_discount := least(v_subtotal, v_payment_discount + v_coupon_discount);
  v_total := greatest(0, v_subtotal + v_shipping - v_discount);
  insert into public.restore_orders(id, data, status, customer_name, phone, city, address, payment_method, subtotal, shipping, discount, total, coupon_code, validated, created_at, updated_at)
  values (v_id, jsonb_build_object('id',v_id,'items',v_items,'customer',p_order->'customer','payment',v_pay,'subtotal',v_subtotal,'shipping',v_shipping,'discount',v_discount,'total',v_total,'serverValidated',true,'stockDecremented',true,'source','secure-checkout-v2'), 'new',
    left(coalesce(p_order#>>'{customer,name}',''),120), left(coalesce(p_order#>>'{customer,phone}',''),40), left(coalesce(p_order#>>'{customer,city}',''),120), left(coalesce(p_order#>>'{customer,address}',''),300), left(coalesce(v_pay->>'id',''),60), v_subtotal, v_shipping, v_discount, v_total, case when v_coupon.code is null then null else upper(v_coupon.code) end, true, v_now, v_now);
  insert into public.restore_order_items(id, order_id, product_id, variant_id, title_snapshot, unit_price, qty, line_total, created_at)
  select 'oi_'||substr(md5(v_id||coalesce(x->>'handle','')||coalesce(x->>'variantId','')||clock_timestamp()::text),1,20), v_id, nullif(x->>'productId',''), nullif(x->>'variantId',''), left(coalesce(x#>>'{title,ar}', x#>>'{title,fr}', x->>'handle',''),200), (x->>'unitPrice')::int, (x->>'qty')::int, (x->>'line')::int, v_now
  from jsonb_array_elements(v_items) x;
  return (select data from public.restore_orders where id=v_id);
end;
$$;
revoke all on function public.restore_create_order_v2(jsonb) from public, anon, authenticated;
grant execute on function public.restore_create_order_v2(jsonb) to service_role;
