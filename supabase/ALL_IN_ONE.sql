-- Restore store 1.8.2 — complete database setup.
-- Paste the WHOLE file into Supabase → SQL Editor → Run (once, on an empty project).
-- Generated 2026-11-13T22:02:53.301Z from supabase/schema.sql, supabase/migrations/0002_relational.sql, supabase/migrations/0003_catalog_source_of_truth.sql, supabase/migrations/0004_catalog_atomic.sql, supabase/migrations/0005_fix_create_order_v2.sql, seed
-- Safe to re-run: migrations are idempotent and the seed does not duplicate rows or reset sold stock.

-- ===== supabase/schema.sql =====
-- Restore store - Supabase schema, row level security and media bucket.
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).
-- The dashboard/static app uses the publishable/anon key only. NEVER put the
-- service_role key in client code, config.js, or this repository.
--
-- Production security model:
--   * Staff access is granted by is_staff()/is_owner() via JWT app_metadata.role.
--   * Store/order totals should be validated server-side by the create-order
--     Edge Function (supabase/functions/create-order). Direct anon order insert
--     remains available for compatibility, but treat client-calculated totals as
--     untrusted until server validation is deployed.
--   * Public abandoned-cart writes are insert-only; do not allow anon updates.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helper functions for role checks
-- ---------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean language sql stable as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('owner', 'manager'),
    false
  );
$$;

create or replace function public.is_owner()
returns boolean language sql stable as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner',
    false
  );
$$;

create or replace function public.restore_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables (order matters: customers/staff before tables referencing them)
-- ---------------------------------------------------------------------------
create table if not exists public.restore_staff (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique not null references auth.users(id) on delete cascade,
  username text unique not null,
  email text not null,
  name jsonb not null default '{}'::jsonb, -- {ar: "", fr: ""}
  role text not null default 'manager' check (role in ('owner', 'manager')),
  whatsapp text,
  avatar text,
  active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists restore_staff_auth_idx on public.restore_staff (auth_id);
create index if not exists restore_staff_username_idx on public.restore_staff (username);

-- Customers are for profile/wishlist/address metadata linked to Supabase Auth.
-- Do NOT store customer passwords here; use Supabase Auth.
create table if not exists public.restore_customers (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique references auth.users(id) on delete set null,
  name text,
  phone text,
  email text,
  addresses jsonb default '[]'::jsonb,
  wishlist jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists restore_customers_auth_idx on public.restore_customers (auth_id);
create index if not exists restore_customers_phone_idx on public.restore_customers (phone);

create table if not exists public.restore_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.restore_orders (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'new',
  customer_id uuid references public.restore_customers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists restore_orders_created_idx on public.restore_orders (created_at desc);
create index if not exists restore_orders_status_idx on public.restore_orders (status);
create index if not exists restore_orders_customer_idx on public.restore_orders (customer_id);

create table if not exists public.restore_abandoned (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  cart_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists restore_abandoned_created_idx on public.restore_abandoned (created_at desc);

create table if not exists public.restore_audit (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists restore_audit_created_idx on public.restore_audit (created_at desc);

-- Reviews/Comments (with moderation)
create table if not exists public.restore_reviews (
  id uuid primary key default gen_random_uuid(),
  product_handle text not null,
  customer_id uuid references public.restore_customers(id) on delete set null,
  customer_name text,
  rating int not null check (rating >= 1 and rating <= 5),
  title text,
  body text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists restore_reviews_product_idx on public.restore_reviews (product_handle);
create index if not exists restore_reviews_status_idx on public.restore_reviews (status);
create index if not exists restore_reviews_customer_idx on public.restore_reviews (customer_id);

-- Custom Pages
create table if not exists public.restore_pages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title jsonb not null, -- {ar: "", fr: ""}
  body jsonb not null,  -- {ar: "", fr: ""}
  seo_title jsonb,
  seo_description jsonb,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists restore_pages_slug_idx on public.restore_pages (slug);

-- Safe additive migrations for existing installations.
alter table public.restore_abandoned add column if not exists cart_token text;
alter table public.restore_abandoned add column if not exists updated_at timestamptz not null default now();
-- Legacy/insecure local-auth column; keep only if you have a controlled migration:
-- alter table public.restore_customers drop column if exists password_hash;

drop trigger if exists restore_orders_touch on public.restore_orders;
create trigger restore_orders_touch before update on public.restore_orders
for each row execute function public.restore_set_updated_at();

drop trigger if exists restore_abandoned_touch on public.restore_abandoned;
create trigger restore_abandoned_touch before update on public.restore_abandoned
for each row execute function public.restore_set_updated_at();

drop trigger if exists restore_state_touch on public.restore_state;
create trigger restore_state_touch before update on public.restore_state
for each row execute function public.restore_set_updated_at();

drop trigger if exists restore_customers_touch on public.restore_customers;
create trigger restore_customers_touch before update on public.restore_customers
for each row execute function public.restore_set_updated_at();

drop trigger if exists restore_reviews_touch on public.restore_reviews;
create trigger restore_reviews_touch before update on public.restore_reviews
for each row execute function public.restore_set_updated_at();

drop trigger if exists restore_pages_touch on public.restore_pages;
create trigger restore_pages_touch before update on public.restore_pages
for each row execute function public.restore_set_updated_at();

drop trigger if exists restore_staff_touch on public.restore_staff;
create trigger restore_staff_touch before update on public.restore_staff
for each row execute function public.restore_set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.restore_state enable row level security;
alter table public.restore_orders enable row level security;
alter table public.restore_abandoned enable row level security;
alter table public.restore_audit enable row level security;
alter table public.restore_staff enable row level security;
alter table public.restore_customers enable row level security;
alter table public.restore_reviews enable row level security;
alter table public.restore_pages enable row level security;

-- Storefront visitors can read the published state but cannot change it.
drop policy if exists restore_state_public_read on public.restore_state;
create policy restore_state_public_read on public.restore_state
  for select to anon, authenticated using (true);

drop policy if exists restore_state_staff_write on public.restore_state;
create policy restore_state_staff_write on public.restore_state
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Orders
-- Secure production path: create orders only via create-order Edge Function
-- (service role / restore_create_order RPC). Direct public inserts are disabled.
drop policy if exists restore_orders_customer_insert on public.restore_orders;
-- COMPATIBILITY ONLY (unsafe): if you cannot deploy the Edge Function yet,
-- you may temporarily allow public insert, but client totals are untrusted.
-- create policy restore_orders_customer_insert on public.restore_orders
--   for insert to anon, authenticated
--   with check (char_length(id) between 3 and 120 and jsonb_typeof(data) = 'object');

-- Customers can read their own orders
drop policy if exists restore_orders_customer_read on public.restore_orders;
create policy restore_orders_customer_read on public.restore_orders
  for select to authenticated
  using (
    customer_id = (select id from public.restore_customers where auth_id = auth.uid())
  );

-- Staff can read/update all orders
drop policy if exists restore_orders_staff_all on public.restore_orders;
create policy restore_orders_staff_all on public.restore_orders
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Abandoned carts: public insert only. No public select/update/delete.
-- Staff manage through authenticated policies / dashboard.
drop policy if exists restore_abandoned_public_insert on public.restore_abandoned;
create policy restore_abandoned_public_insert on public.restore_abandoned
  for insert to anon
  with check (char_length(id) between 3 and 120 and jsonb_typeof(data) = 'object');

drop policy if exists restore_abandoned_public_update on public.restore_abandoned;
-- Intentionally removed: anon updates exposed other customers' carts.

drop policy if exists restore_abandoned_staff_all on public.restore_abandoned;
create policy restore_abandoned_staff_all on public.restore_abandoned
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Audit logs - only staff can read/write
drop policy if exists restore_audit_staff_all on public.restore_audit;
create policy restore_audit_staff_all on public.restore_audit
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Staff - can read own profile, owner can manage all staff
drop policy if exists restore_staff_own_read on public.restore_staff;
create policy restore_staff_own_read on public.restore_staff
  for select to authenticated
  using (auth_id = auth.uid() or public.is_owner());

drop policy if exists restore_staff_own_update on public.restore_staff;
create policy restore_staff_own_update on public.restore_staff
  for update to authenticated
  using (auth_id = auth.uid()) with check (auth_id = auth.uid());

drop policy if exists restore_staff_owner_all on public.restore_staff;
create policy restore_staff_owner_all on public.restore_staff
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- Customers - can read/write own data, staff can read all
drop policy if exists restore_customers_own_read on public.restore_customers;
create policy restore_customers_own_read on public.restore_customers
  for select to authenticated using (auth_id = auth.uid() or public.is_staff());

drop policy if exists restore_customers_own_insert on public.restore_customers;
create policy restore_customers_own_insert on public.restore_customers
  for insert to authenticated with check (auth_id = auth.uid() or public.is_staff());

drop policy if exists restore_customers_own_update on public.restore_customers;
create policy restore_customers_own_update on public.restore_customers
  for update to authenticated using (auth_id = auth.uid()) with check (auth_id = auth.uid());

drop policy if exists restore_customers_staff_all on public.restore_customers;
create policy restore_customers_staff_all on public.restore_customers
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Reviews - public can read approved, customers can create/read own, staff moderate all
drop policy if exists restore_reviews_public_read on public.restore_reviews;
create policy restore_reviews_public_read on public.restore_reviews
  for select to anon, authenticated using (status = 'approved');

drop policy if exists restore_reviews_customer_create on public.restore_reviews;
create policy restore_reviews_customer_create on public.restore_reviews
  for insert to authenticated
  with check (customer_id = (select id from public.restore_customers where auth_id = auth.uid()));

drop policy if exists restore_reviews_customer_read_own on public.restore_reviews;
create policy restore_reviews_customer_read_own on public.restore_reviews
  for select to authenticated
  using (customer_id = (select id from public.restore_customers where auth_id = auth.uid()));

drop policy if exists restore_reviews_staff_all on public.restore_reviews;
create policy restore_reviews_staff_all on public.restore_reviews
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Pages - public read visible, staff manage all
drop policy if exists restore_pages_public_read on public.restore_pages;
create policy restore_pages_public_read on public.restore_pages
  for select to anon, authenticated using (visible = true);

drop policy if exists restore_pages_staff_all on public.restore_pages;
create policy restore_pages_staff_all on public.restore_pages
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- Media bucket (public read, staff upload)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'restore-media',
  'restore-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists restore_media_public_read on storage.objects;
create policy restore_media_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'restore-media');

drop policy if exists restore_media_staff_insert on storage.objects;
create policy restore_media_staff_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'restore-media' and public.is_staff());

drop policy if exists restore_media_staff_update on storage.objects;
create policy restore_media_staff_update on storage.objects
  for update to authenticated
  using (bucket_id = 'restore-media' and public.is_staff())
  with check (bucket_id = 'restore-media' and public.is_staff());

drop policy if exists restore_media_staff_delete on storage.objects;
create policy restore_media_staff_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'restore-media' and public.is_staff());

-- ---------------------------------------------------------------------------
-- Explicit grants (least privilege; RLS still applies)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on public.restore_state to anon, authenticated;
grant select on public.restore_reviews to anon, authenticated;
grant select on public.restore_pages to anon, authenticated;

-- Orders: no direct public insert. Use create-order Edge Function (RPC/service role).
grant insert on public.restore_abandoned to anon;

grant select, insert, update, delete on public.restore_state to authenticated;
grant select, insert, update, delete on public.restore_orders to authenticated;
grant select, insert, update, delete on public.restore_abandoned to authenticated;
grant select, insert, update, delete on public.restore_audit to authenticated;
grant select, insert, update, delete on public.restore_staff to authenticated;
grant select, insert, update, delete on public.restore_customers to authenticated;
grant select, insert, update, delete on public.restore_reviews to authenticated;
grant select, insert, update, delete on public.restore_pages to authenticated;

-- ---------------------------------------------------------------------------
-- Atomic server-side order creation (use via Edge Function / service role)
-- Validates totals from restore_state, decrements stock, inserts order.
-- ---------------------------------------------------------------------------
create or replace function public.restore_create_order(p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_settings jsonb;
  v_products jsonb;
  v_product jsonb;
  v_items_in jsonb := coalesce(p_order->'items', '[]'::jsonb);
  v_item jsonb;
  v_out_items jsonb := '[]'::jsonb;
  v_handle text;
  v_qty int;
  v_stock int;
  v_price numeric;
  v_subtotal numeric := 0;
  v_shipping numeric := 0;
  v_payment_discount numeric := 0;
  v_coupon_discount numeric := 0;
  v_discount numeric := 0;
  v_total numeric := 0;
  v_city jsonb;
  v_payment jsonb;
  v_coupon jsonb;
  v_code text;
  v_id text;
  v_now timestamptz := now();
  v_safe jsonb;
  i int;
begin
  if jsonb_typeof(v_items_in) <> 'array' or jsonb_array_length(v_items_in) < 1 then
    raise exception 'Order items are required';
  end if;

  select data into v_state from public.restore_state where id = 'main' for update;
  if v_state is null then raise exception 'Store state is not published'; end if;
  v_settings := coalesce(v_state->'settings', '{}'::jsonb);
  if coalesce((v_settings->>'open')::boolean, true) = false then raise exception 'Store is closed'; end if;
  v_products := coalesce(v_state->'products', '[]'::jsonb);

  for v_item in select * from jsonb_array_elements(v_items_in)
  loop
    v_handle := btrim(coalesce(v_item->>'handle',''));
    v_qty := greatest(1, least(20, coalesce((v_item->>'qty')::int, 1)));
    select p into v_product
      from jsonb_array_elements(v_products) p
      where p->>'handle' = v_handle
      limit 1;
    if v_product is null then raise exception 'Unknown product: %', v_handle; end if;
    v_stock := greatest(0, coalesce((v_product->>'stock')::int, 0));
    if coalesce((v_product->>'hideWhenOOS')::boolean, false) and v_stock < 1 then
      raise exception 'Out of stock: %', v_handle;
    end if;
    if v_stock > 0 and v_qty > v_stock then
      raise exception 'Insufficient stock: %', v_handle;
    end if;
    v_price := round(coalesce((v_product->>'price')::numeric, 0));
    if jsonb_typeof(v_product->'variants') = 'array' then
      select round(coalesce((v->>'price')::numeric, v_price)) into v_price
        from jsonb_array_elements(v_product->'variants') v
        where coalesce(v->>'id','') = coalesce(v_item->>'variantId','')
        limit 1;
      if v_price is null then v_price := round(coalesce((v_product->>'price')::numeric, 0)); end if;
    end if;
    v_price := greatest(0, v_price);
    v_subtotal := v_subtotal + (v_price * v_qty);
    v_out_items := v_out_items || jsonb_build_array(jsonb_build_object(
      'handle', v_handle,
      'title', v_product->'title',
      'image', v_product->'image',
      'variantId', nullif(v_item->>'variantId',''),
      'qty', v_qty,
      'price', v_price,
      'line', v_price * v_qty
    ));

    -- decrement stock in state JSON
    select jsonb_agg(
      case when p->>'handle' = v_handle then
        jsonb_set(
          jsonb_set(p, '{stock}', to_jsonb(greatest(0, coalesce((p->>'stock')::int,0) - v_qty)), true),
          '{lowStock}', to_jsonb(greatest(0, coalesce((p->>'stock')::int,0) - v_qty) <= greatest(0, coalesce((v_settings->>'lowStockThreshold')::int,2))), true
        )
      else p end
    ) into v_products
    from jsonb_array_elements(v_products) p;
  end loop;

  select c into v_city
    from jsonb_array_elements(coalesce(v_settings->'cities','[]'::jsonb)) c
    where coalesce(c->>'id','') = coalesce(p_order#>>'{customer,cityId}', p_order->>'cityId','')
    limit 1;
  if v_subtotal >= coalesce((v_settings->>'freeShippingOver')::numeric, 0) then
    v_shipping := 0;
  else
    v_shipping := greatest(0, round(coalesce((v_city->>'fee')::numeric, 0)));
  end if;

  select p into v_payment
    from jsonb_array_elements(coalesce(v_settings->'payments','[]'::jsonb)) p
    where coalesce((p->>'active')::boolean, true) = true
      and coalesce(p->>'id','') = coalesce(p_order#>>'{payment,id}', p_order->>'paymentId','')
    limit 1;
  if v_payment is null then
    select p into v_payment
      from jsonb_array_elements(coalesce(v_settings->'payments','[]'::jsonb)) p
      where coalesce((p->>'active')::boolean, true) = true
      limit 1;
  end if;
  if v_payment is null then raise exception 'No active payment method'; end if;
  v_payment_discount := round(v_subtotal * greatest(0, coalesce((v_payment->>'discount')::numeric,0)) / 100);

  v_code := upper(btrim(coalesce(p_order->>'coupon', p_order->>'couponCode', '')));
  if v_code <> '' then
    select c into v_coupon
      from jsonb_array_elements(coalesce(v_settings->'coupons','[]'::jsonb)) c
      where coalesce((c->>'active')::boolean, true) = true
        and upper(coalesce(c->>'code','')) = v_code
      limit 1;
    if v_coupon is not null and coalesce(p_order->>'couponExpired','false') <> 'true' then
      if (v_coupon ? 'expiresAt') and (v_coupon->>'expiresAt') <> '' and (v_coupon->>'expiresAt')::timestamptz < v_now then
        v_coupon := null;
      elsif v_subtotal >= coalesce((v_coupon->>'minTotal')::numeric, 0) then
        if coalesce(v_coupon->>'type','') = 'percent' then
          v_coupon_discount := round(v_subtotal * greatest(0, coalesce((v_coupon->>'value')::numeric,0)) / 100);
        else
          v_coupon_discount := greatest(0, round(coalesce((v_coupon->>'value')::numeric,0)));
        end if;
        v_code := upper(coalesce(v_coupon->>'code', v_code));
      else
        v_coupon := null;
      end if;
    else
      v_code := '';
    end if;
  end if;

  v_discount := least(v_subtotal, v_payment_discount + v_coupon_discount);
  v_total := greatest(0, v_subtotal + v_shipping - v_discount);
  v_id := coalesce(nullif(left(btrim(coalesce(p_order->>'id','')),120),''), 'RS-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)));
  v_now := now();

  v_safe := jsonb_build_object(
    'id', v_id,
    'createdAt', to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'updatedAt', to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'status', 'new',
    'source', 'secure-checkout',
    'lang', left(coalesce(p_order->>'lang','ar'),5),
    'customer', jsonb_build_object(
      'name', left(btrim(coalesce(p_order#>>'{customer,name}','')),120),
      'phone', left(btrim(coalesce(p_order#>>'{customer,phone}','')),40),
      'email', left(btrim(coalesce(p_order#>>'{customer,email}','')),120),
      'city', coalesce(v_city->'name', to_jsonb(left(coalesce(p_order#>>'{customer,city}',''),80))),
      'cityId', v_city->>'id',
      'address', left(btrim(coalesce(p_order#>>'{customer,address}','')),300),
      'notes', left(btrim(coalesce(p_order#>>'{customer,notes}','')),500)
    ),
    'items', v_out_items,
    'subtotal', v_subtotal,
    'shipping', v_shipping,
    'paymentDiscount', v_payment_discount,
    'couponDiscount', v_coupon_discount,
    'coupon', case when v_coupon is null then '' else v_code end,
    'discount', v_discount,
    'total', v_total,
    'payment', jsonb_build_object('id', v_payment->>'id', 'name', v_payment->'name', 'discount', coalesce((v_payment->>'discount')::numeric,0)),
    'currency', 'MRU',
    'serverValidated', true,
    'stockDecremented', true
  );

  update public.restore_state
    set data = jsonb_set(v_state, '{products}', v_products, true),
        updated_at = v_now
    where id = 'main';

  insert into public.restore_orders (id, data, status, created_at, updated_at)
  values (v_id, v_safe, 'new', v_now, v_now);

  return v_safe;
end;
$$;

revoke all on function public.restore_create_order(jsonb) from public, anon, authenticated;
grant execute on function public.restore_create_order(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Shared rate limiting (used by Edge Functions via service_role)
-- ---------------------------------------------------------------------------
create table if not exists public.restore_rate_limits (
  key text primary key,
  count int not null default 0,
  reset_at timestamptz not null
);

create or replace function public.restore_rate_hit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_row public.restore_rate_limits%rowtype;
begin
  insert into public.restore_rate_limits(key, count, reset_at)
  values (left(coalesce(p_key,''), 200), 1, v_now + make_interval(secs => greatest(1, p_window_seconds)))
  on conflict (key) do update
    set count = case when public.restore_rate_limits.reset_at <= v_now then 1 else public.restore_rate_limits.count + 1 end,
        reset_at = case when public.restore_rate_limits.reset_at <= v_now then v_now + make_interval(secs => greatest(1, p_window_seconds)) else public.restore_rate_limits.reset_at end
  returning * into v_row;
  return v_row.count <= greatest(1, p_limit);
end;
$$;

alter table public.restore_rate_limits enable row level security;
revoke all on public.restore_rate_limits from public, anon, authenticated;
revoke all on function public.restore_rate_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.restore_rate_hit(text, int, int) to service_role;


-- ===== supabase/migrations/0002_relational.sql =====
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


-- ===== supabase/migrations/0003_catalog_source_of_truth.sql =====
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


-- ===== supabase/migrations/0004_catalog_atomic.sql =====
-- Restore migration 0004: atomic catalog writes + server-side audit trail
-- Run after 0003. Idempotent. STORAGE + INTEGRITY ONLY: no pricing/discount logic lives here.
--
--   * restore_upsert_product(p jsonb)  -> one transaction: product upsert, variants replaced,
--                                         collection links replaced (handles -> ids), meta bumped.
--   * restore_delete_product(p_id text) -> same pattern.
--   * restore_audit_log + trigger restore_audit_row(): every insert/update/delete on catalog,
--                                         coupon and order tables is recorded with auth.uid(),
--                                         regardless of whether it came from the dashboard,
--                                         the SQL editor or a script.
--   * indexes for reporting.

-- ---------------------------------------------------------------------------
-- 1. Atomic upsert
-- ---------------------------------------------------------------------------
create or replace function public.restore_upsert_product(p jsonb)
returns public.restore_products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row       public.restore_products;
  v_prod      jsonb := coalesce(p->'row', p);          -- accept {row,variants,collectionHandles} or a bare row
  v_variants  jsonb := coalesce(p->'variants', '[]'::jsonb);
  v_handles   jsonb := coalesce(p->'collectionHandles', '[]'::jsonb);
  v_id        text  := coalesce(nullif(v_prod->>'id',''), v_prod->>'handle');
  v_handle    text  := v_prod->>'handle';
  v_price     int   := coalesce((v_prod->>'price')::int, 0);
  v_stock     int   := coalesce((v_prod->>'stock')::int, 0);
  v_compare   int   := nullif(v_prod->>'compare_at','')::int;
  v_item      jsonb;
  v_i         int := 0;
begin
  -- authorization
  if not public.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- validation only (shape / ranges). No business rules.
  if v_handle is null or v_handle !~ '^[a-z0-9][a-z0-9_-]{1,118}$' then
    raise exception 'invalid handle: %', v_handle using errcode = '22023';
  end if;
  if v_price < 0 or v_stock < 0 or (v_compare is not null and v_compare < 0) then
    raise exception 'price/stock must be >= 0' using errcode = '22023';
  end if;
  if jsonb_typeof(v_prod->'title') is distinct from 'object' then
    raise exception 'title must be an object {ar,fr}' using errcode = '22023';
  end if;

  insert into public.restore_products
    (id, handle, title, brand, category_id, price, compare_at, stock, condition, specs, images, active, sku, sort_order, extra)
  values
    (v_id, v_handle, v_prod->'title', nullif(v_prod->>'brand',''), nullif(v_prod->>'category_id',''),
     v_price, v_compare, v_stock, nullif(v_prod->>'condition',''),
     coalesce(v_prod->'specs','{}'::jsonb), coalesce(v_prod->'images','[]'::jsonb),
     coalesce((v_prod->>'active')::boolean, true), nullif(v_prod->>'sku',''),
     coalesce((v_prod->>'sort_order')::int, 0), coalesce(v_prod->'extra','{}'::jsonb))
  on conflict (id) do update set
    handle = excluded.handle, title = excluded.title, brand = excluded.brand, category_id = excluded.category_id,
    price = excluded.price, compare_at = excluded.compare_at, stock = excluded.stock, condition = excluded.condition,
    specs = excluded.specs, images = excluded.images, active = excluded.active, sku = excluded.sku,
    sort_order = excluded.sort_order, extra = excluded.extra, updated_at = now()
  returning * into v_row;

  -- variants: replace set
  delete from public.restore_product_variants where product_id = v_row.id;
  for v_item in select * from jsonb_array_elements(v_variants) loop
    v_i := v_i + 1;
    insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock)
    values (coalesce(nullif(v_item->>'id',''), v_row.id || '_v' || v_i), v_row.id,
            nullif(v_item->>'sku',''), nullif(v_item->>'color',''), nullif(v_item->>'storage',''),
            coalesce((v_item->>'price_delta')::int, 0), greatest(0, coalesce((v_item->>'stock')::int, 0)));
  end loop;

  -- collection links: replace set, order preserved
  delete from public.restore_collection_products where product_id = v_row.id;
  insert into public.restore_collection_products (collection_id, product_id, sort_order)
  select c.id, v_row.id, h.ord - 1
  from jsonb_array_elements_text(v_handles) with ordinality as h(handle, ord)
  join public.restore_collections c on c.handle = h.handle;

  -- change marker
  insert into public.restore_catalog_meta (id, version, updated_at)
  values ('main', (extract(epoch from clock_timestamp()) * 1000)::bigint, now())
  on conflict (id) do update set version = excluded.version, updated_at = excluded.updated_at;

  return v_row;
end;
$$;

create or replace function public.restore_delete_product(p_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  if not public.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.restore_products where id = p_id or handle = p_id; -- variants/links cascade
  get diagnostics v_n = row_count;
  insert into public.restore_catalog_meta (id, version, updated_at)
  values ('main', (extract(epoch from clock_timestamp()) * 1000)::bigint, now())
  on conflict (id) do update set version = excluded.version, updated_at = excluded.updated_at;
  return v_n > 0;
end;
$$;

revoke all on function public.restore_upsert_product(jsonb) from public, anon;
revoke all on function public.restore_delete_product(text) from public, anon;
grant execute on function public.restore_upsert_product(jsonb) to authenticated;
grant execute on function public.restore_delete_product(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Server-side audit trail (storage only)
-- ---------------------------------------------------------------------------
create table if not exists public.restore_audit_log (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  row_id      text not null,
  action      text not null check (action in ('INSERT','UPDATE','DELETE')),
  actor       uuid,                      -- auth.uid(); null for service-role / SQL editor
  actor_role  text,                      -- current_setting('request.jwt.claim.role', true)
  diff        jsonb not null default '{}'::jsonb,
  at          timestamptz not null default now()
);
create index if not exists restore_audit_log_at_idx on public.restore_audit_log (at desc);
create index if not exists restore_audit_log_row_idx on public.restore_audit_log (table_name, row_id);
alter table public.restore_audit_log enable row level security;
drop policy if exists restore_audit_log_staff_read on public.restore_audit_log;
create policy restore_audit_log_staff_read on public.restore_audit_log for select to authenticated using (public.is_staff());
-- nobody writes directly; only the trigger (security definer) does.
revoke insert, update, delete on public.restore_audit_log from anon, authenticated;
grant select on public.restore_audit_log to authenticated;

create or replace function public.restore_audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
  v_new jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end;
  v_diff jsonb := '{}'::jsonb;
  v_key text;
  v_pk  text;
begin
  if tg_op = 'UPDATE' then
    -- only changed keys (before/after), skipping noisy timestamps
    for v_key in select jsonb_object_keys(v_new) loop
      if v_key not in ('updated_at') and v_old->v_key is distinct from v_new->v_key then
        v_diff := v_diff || jsonb_build_object(v_key, jsonb_build_object('old', v_old->v_key, 'new', v_new->v_key));
      end if;
    end loop;
    if v_diff = '{}'::jsonb then return new; end if; -- no-op update
  elsif tg_op = 'INSERT' then
    v_diff := jsonb_build_object('new', v_new);
  else
    v_diff := jsonb_build_object('old', v_old);
  end if;
  v_pk := coalesce(coalesce(v_new, v_old)->>'id', coalesce(v_new, v_old)->>'code',
                   (coalesce(v_new, v_old)->>'collection_id') || ':' || (coalesce(v_new, v_old)->>'product_id'), '?');
  insert into public.restore_audit_log (table_name, row_id, action, actor, actor_role, diff)
  values (tg_table_name, v_pk, tg_op, auth.uid(), current_setting('request.jwt.claim.role', true), v_diff);
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['restore_products','restore_product_variants','restore_collections',
                           'restore_collection_products','restore_coupons','restore_orders']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
      execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.restore_audit_row()', t || '_audit', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Reporting indexes
-- ---------------------------------------------------------------------------
create index if not exists restore_orders_created_status_idx on public.restore_orders (created_at desc, status);
create index if not exists restore_products_active_sort_idx on public.restore_products (active, sort_order);


-- ===== supabase/migrations/0005_fix_create_order_v2.sql =====
-- Restore migration 0005: fix restore_create_order_v2 (found by integration test on PostgreSQL 16)
-- Bugs in 0002:
--   1. `v_v record` was never assigned when an item had no variantId → "record v_v is not assigned yet"
--      → EVERY order without variants failed. Same for `v_coupon record` when no coupon was sent.
--   2. When item #1 had a variant and item #2 did not, v_v kept item #1's variant → wrong stock decrement.
-- Fix: typed composite variables (null-row initialised) + explicit reset per item. Logic otherwise unchanged.
create or replace function public.restore_create_order_v2(p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_id text := coalesce(nullif(left(btrim(coalesce(p_order->>'id','')),120),''), 'RS-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)));
  v_item jsonb; v_p public.restore_products; v_v public.restore_product_variants; v_qty int; v_unit int; v_line int; v_subtotal int := 0; v_shipping int := 0; v_discount int := 0; v_total int := 0;
  v_coupon public.restore_coupons; v_coupon_discount int := 0; v_payment_discount int := 0; v_pay jsonb; v_settings jsonb; v_city_fee int := 0; v_items jsonb := '[]'::jsonb;
begin
  select data->'settings' into v_settings from public.restore_state where id='main';
  v_city_fee := 0;
  if jsonb_typeof(p_order->'items') <> 'array' or jsonb_array_length(p_order->'items') < 1 then raise exception 'Order items are required'; end if;
  for v_item in select * from jsonb_array_elements(p_order->'items') loop
    v_qty := greatest(1, least(20, coalesce((v_item->>'qty')::int,1)));
    v_v := null; -- reset: previous item's variant must never leak into this one
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


-- ===== seed: demo catalog (generated by scripts/seed-catalog.mjs — idempotent, safe to re-run) =====
-- Lets a brand-new store take validated orders immediately. Replace the demo products from the dashboard.
begin;
insert into public.restore_collections (id, handle, title, description, active, sort_order, extra) values ('special-offers', 'special-offers', '{"ar":"Special Offers","fr":"Special Offers"}'::jsonb, '{"ar":"","fr":""}'::jsonb, true, 0, '{}'::jsonb) on conflict (id) do nothing;
insert into public.restore_collections (id, handle, title, description, active, sort_order, extra) values ('phones', 'phones', '{"ar":"Smartphones","fr":"Smartphones"}'::jsonb, '{"ar":"","fr":""}'::jsonb, true, 0, '{}'::jsonb) on conflict (id) do nothing;
insert into public.restore_collections (id, handle, title, description, active, sort_order, extra) values ('android', 'android', '{"ar":"Android","fr":"Android"}'::jsonb, '{"ar":"","fr":""}'::jsonb, true, 0, '{}'::jsonb) on conflict (id) do nothing;
insert into public.restore_collections (id, handle, title, description, active, sort_order, extra) values ('laptops', 'laptops', '{"ar":"Laptops","fr":"Laptops"}'::jsonb, '{"ar":"","fr":""}'::jsonb, true, 0, '{}'::jsonb) on conflict (id) do nothing;
insert into public.restore_collections (id, handle, title, description, active, sort_order, extra) values ('macbooks', 'macbooks', '{"ar":"Creator Laptops","fr":"Creator Laptops"}'::jsonb, '{"ar":"","fr":""}'::jsonb, true, 0, '{}'::jsonb) on conflict (id) do nothing;
insert into public.restore_collections (id, handle, title, description, active, sort_order, extra) values ('tablets', 'tablets', '{"ar":"Tablets","fr":"Tablets"}'::jsonb, '{"ar":"","fr":""}'::jsonb, true, 0, '{}'::jsonb) on conflict (id) do nothing;
insert into public.restore_collections (id, handle, title, description, active, sort_order, extra) values ('watches', 'watches', '{"ar":"Smartwatches","fr":"Smartwatches"}'::jsonb, '{"ar":"","fr":""}'::jsonb, true, 0, '{}'::jsonb) on conflict (id) do nothing;
insert into public.restore_collections (id, handle, title, description, active, sort_order, extra) values ('audio', 'audio', '{"ar":"صوتيات","fr":"Audio"}'::jsonb, '{"ar":"","fr":""}'::jsonb, true, 0, '{}'::jsonb) on conflict (id) do nothing;
insert into public.restore_collections (id, handle, title, description, active, sort_order, extra) values ('chargers', 'chargers', '{"ar":"Chargers & Power","fr":"Chargers & Power"}'::jsonb, '{"ar":"","fr":""}'::jsonb, true, 0, '{}'::jsonb) on conflict (id) do nothing;
insert into public.restore_collections (id, handle, title, description, active, sort_order, extra) values ('gaming', 'gaming', '{"ar":"ألعاب","fr":"Gaming"}'::jsonb, '{"ar":"","fr":""}'::jsonb, true, 0, '{}'::jsonb) on conflict (id) do nothing;
insert into public.restore_collections (id, handle, title, description, active, sort_order, extra) values ('accessories', 'accessories', '{"ar":"Cases & Protection","fr":"Cases & Protection"}'::jsonb, '{"ar":"","fr":""}'::jsonb, true, 0, '{}'::jsonb) on conflict (id) do nothing;
insert into public.restore_products (id, handle, title, brand, price, compare_at, stock, condition, specs, images, active, sku, sort_order, extra) values ('smartphone-pro-128', 'smartphone-pro-128', '{"ar":"Smartphone Pro 128 GB","fr":"Smartphone Pro 128 GB"}'::jsonb, 'Demo Mobile', 136740, 200340, 6, 'New', '{"cpu":{"label":{"ar":"المعالج","fr":"Processeur"},"value":"SoC","choices":[]},"ram":{"label":{"ar":"الذاكرة","fr":"Mémoire RAM"},"value":"6 GB","choices":[]},"storage":{"label":{"ar":"التخزين","fr":"Stockage"},"value":"128 GB","choices":[]},"screen":{"label":{"ar":"حجم الشاشة","fr":"Taille d’écran"},"value":"6.1\"","choices":["5.8\"","6.1\"","6.7\""]},"keyboard":{"label":{"ar":"لوحة المفاتيح","fr":"Clavier"},"value":null,"choices":[]},"condition":{"label":{"ar":"الحالة","fr":"État"},"value":"New","choices":[]},"battery":{"label":{"ar":"صحة البطارية","fr":"Santé de la batterie"},"value":"99%","choices":[]}}'::jsonb, '["assets/products/smartphone-pro-128.svg"]'::jsonb, true, 'RS-0001', 0, '{"type":"Smartphone","discount":32,"colors":[{"name":"Black","hex":"#111827"},{"name":"Blue","hex":"#2563eb"}],"options":[{"name":"Storage","values":["128 GB","256 GB"]},{"name":"Condition","values":["New","Excellent"]}],"available":true,"body":"<p>Demo product. Replace this description from the dashboard.</p>","battery":99,"description":{"ar":"هاتف مجدد بالكامل، تم فحصه وتنظيفه واختباره من طرف خبراء متجر تجريبي. يعمل بكفاءة عالية ويأتي بضمان 12 شهرًا.","fr":"Téléphone entièrement reconditionné, inspecté, nettoyé et testé par les experts Demo Store. Il fonctionne parfaitement et bénéficie d’une garantie de 12 mois."},"includes":[{"ar":"الهاتف","fr":"Téléphone"},{"ar":"كابل الشحن","fr":"Câble de charge"},{"ar":"أداة إخراج الشريحة","fr":"Outil SIM"}],"colorImages":{"Black":"assets/products/smartphone-pro-128.svg","Blue":"assets/products/smartphone-pro-128.svg"},"colorRemote":{},"warrantyMonths":12,"lowStock":false,"collections":["phones","special-offers"],"image":"assets/products/smartphone-pro-128.svg"}'::jsonb) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1001', 'smartphone-pro-128', null, null, null, 0, 6) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1002', 'smartphone-pro-128', null, null, null, 16410, 6) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1003', 'smartphone-pro-128', null, null, null, 16410, 6) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1004', 'smartphone-pro-128', null, null, null, 32820, 6) on conflict (id) do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('phones', 'smartphone-pro-128', 0) on conflict do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('special-offers', 'smartphone-pro-128', 1) on conflict do nothing;
insert into public.restore_products (id, handle, title, brand, price, compare_at, stock, condition, specs, images, active, sku, sort_order, extra) values ('smartphone-lite-64', 'smartphone-lite-64', '{"ar":"Smartphone Lite 64 GB","fr":"Smartphone Lite 64 GB"}'::jsonb, 'Demo Mobile', 73140, 94340, 6, 'Excellent', '{"cpu":{"label":{"ar":"المعالج","fr":"Processeur"},"value":"SoC","choices":[]},"ram":{"label":{"ar":"الذاكرة","fr":"Mémoire RAM"},"value":"6 GB","choices":[]},"storage":{"label":{"ar":"التخزين","fr":"Stockage"},"value":"64 GB","choices":[]},"screen":{"label":{"ar":"حجم الشاشة","fr":"Taille d’écran"},"value":"6.1\"","choices":["5.8\"","6.1\"","6.7\""]},"keyboard":{"label":{"ar":"لوحة المفاتيح","fr":"Clavier"},"value":null,"choices":[]},"condition":{"label":{"ar":"الحالة","fr":"État"},"value":"Excellent","choices":[]},"battery":{"label":{"ar":"صحة البطارية","fr":"Santé de la batterie"},"value":"89%","choices":[]}}'::jsonb, '["assets/products/smartphone-lite-64.svg"]'::jsonb, true, 'RS-0002', 0, '{"type":"Smartphone","discount":22,"colors":[{"name":"Silver","hex":"#cbd5e1"}],"options":[{"name":"Storage","values":["64 GB","128 GB"]}],"available":true,"body":"","battery":89,"description":{"ar":"هاتف مجدد بالكامل، تم فحصه وتنظيفه واختباره من طرف خبراء متجر تجريبي. يعمل بكفاءة عالية ويأتي بضمان 12 شهرًا.","fr":"Téléphone entièrement reconditionné, inspecté, nettoyé et testé par les experts Demo Store. Il fonctionne parfaitement et bénéficie d’une garantie de 12 mois."},"includes":[{"ar":"الهاتف","fr":"Téléphone"},{"ar":"كابل الشحن","fr":"Câble de charge"},{"ar":"أداة إخراج الشريحة","fr":"Outil SIM"}],"colorImages":{"Silver":"assets/products/smartphone-lite-64.svg"},"colorRemote":{},"warrantyMonths":12,"lowStock":false,"collections":["phones","special-offers"],"image":"assets/products/smartphone-lite-64.svg"}'::jsonb) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1005', 'smartphone-lite-64', null, null, null, 0, 6) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1006', 'smartphone-lite-64', null, null, null, 8775, 6) on conflict (id) do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('phones', 'smartphone-lite-64', 0) on conflict do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('special-offers', 'smartphone-lite-64', 1) on conflict do nothing;
insert into public.restore_products (id, handle, title, brand, price, compare_at, stock, condition, specs, images, active, sku, sort_order, extra) values ('smartphone-max-256', 'smartphone-max-256', '{"ar":"Smartphone Max 256 GB","fr":"Smartphone Max 256 GB"}'::jsonb, 'Demo Mobile', 189740, null, 9, 'Good', '{"cpu":{"label":{"ar":"المعالج","fr":"Processeur"},"value":"SoC","choices":[]},"ram":{"label":{"ar":"الذاكرة","fr":"Mémoire RAM"},"value":"6 GB","choices":[]},"storage":{"label":{"ar":"التخزين","fr":"Stockage"},"value":"256 GB","choices":[]},"screen":{"label":{"ar":"حجم الشاشة","fr":"Taille d’écran"},"value":"6.1\"","choices":["5.8\"","6.1\"","6.7\""]},"keyboard":{"label":{"ar":"لوحة المفاتيح","fr":"Clavier"},"value":null,"choices":[]},"condition":{"label":{"ar":"الحالة","fr":"État"},"value":"Excellent","choices":[]},"battery":{"label":{"ar":"صحة البطارية","fr":"Santé de la batterie"},"value":"86%","choices":[]}}'::jsonb, '["assets/products/smartphone-max-256.svg"]'::jsonb, true, 'RS-0003', 0, '{"type":"Smartphone","discount":0,"colors":[{"name":"Green","hex":"#059669"}],"options":[{"name":"Storage","values":["256 GB","512 GB"]}],"available":true,"body":"","battery":86,"description":{"ar":"هاتف مجدد بالكامل، تم فحصه وتنظيفه واختباره من طرف خبراء متجر تجريبي. يعمل بكفاءة عالية ويأتي بضمان 12 شهرًا.","fr":"Téléphone entièrement reconditionné, inspecté, nettoyé et testé par les experts Demo Store. Il fonctionne parfaitement et bénéficie d’une garantie de 12 mois."},"includes":[{"ar":"الهاتف","fr":"Téléphone"},{"ar":"كابل الشحن","fr":"Câble de charge"},{"ar":"أداة إخراج الشريحة","fr":"Outil SIM"}],"colorImages":{"Green":"assets/products/smartphone-max-256.svg"},"colorRemote":{},"warrantyMonths":12,"lowStock":false,"collections":["phones"],"image":"assets/products/smartphone-max-256.svg"}'::jsonb) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1007', 'smartphone-max-256', null, null, null, 0, 9) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1008', 'smartphone-max-256', null, null, null, 22770, 9) on conflict (id) do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('phones', 'smartphone-max-256', 0) on conflict do nothing;
insert into public.restore_products (id, handle, title, brand, price, compare_at, stock, condition, specs, images, active, sku, sort_order, extra) values ('smartphone-mini-128', 'smartphone-mini-128', '{"ar":"Smartphone Mini 128 GB","fr":"Smartphone Mini 128 GB"}'::jsonb, 'Demo Mobile', 94340, 126140, 13, 'Excellent', '{"cpu":{"label":{"ar":"المعالج","fr":"Processeur"},"value":"SoC","choices":[]},"ram":{"label":{"ar":"الذاكرة","fr":"Mémoire RAM"},"value":"6 GB","choices":[]},"storage":{"label":{"ar":"التخزين","fr":"Stockage"},"value":"128 GB","choices":[]},"screen":{"label":{"ar":"حجم الشاشة","fr":"Taille d’écran"},"value":"6.1\"","choices":["5.8\"","6.1\"","6.7\""]},"keyboard":{"label":{"ar":"لوحة المفاتيح","fr":"Clavier"},"value":null,"choices":[]},"condition":{"label":{"ar":"الحالة","fr":"État"},"value":"Excellent","choices":[]},"battery":{"label":{"ar":"صحة البطارية","fr":"Santé de la batterie"},"value":"93%","choices":[]}}'::jsonb, '["assets/products/smartphone-mini-128.svg"]'::jsonb, true, 'RS-0004', 0, '{"type":"Smartphone","discount":25,"colors":[{"name":"Pink","hex":"#db2777"}],"options":[{"name":"Storage","values":["128 GB"]}],"available":true,"body":"","battery":93,"description":{"ar":"هاتف مجدد بالكامل، تم فحصه وتنظيفه واختباره من طرف خبراء متجر تجريبي. يعمل بكفاءة عالية ويأتي بضمان 12 شهرًا.","fr":"Téléphone entièrement reconditionné, inspecté, nettoyé et testé par les experts Demo Store. Il fonctionne parfaitement et bénéficie d’une garantie de 12 mois."},"includes":[{"ar":"الهاتف","fr":"Téléphone"},{"ar":"كابل الشحن","fr":"Câble de charge"},{"ar":"أداة إخراج الشريحة","fr":"Outil SIM"}],"colorImages":{"Pink":"assets/products/smartphone-mini-128.svg"},"colorRemote":{},"warrantyMonths":12,"lowStock":false,"collections":["phones","special-offers"],"image":"assets/products/smartphone-mini-128.svg"}'::jsonb) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1009', 'smartphone-mini-128', null, null, null, 0, 13) on conflict (id) do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('phones', 'smartphone-mini-128', 0) on conflict do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('special-offers', 'smartphone-mini-128', 1) on conflict do nothing;
insert into public.restore_products (id, handle, title, brand, price, compare_at, stock, condition, specs, images, active, sku, sort_order, extra) values ('android-flagship-256', 'android-flagship-256', '{"ar":"Android Flagship 256 GB","fr":"Android Flagship 256 GB"}'::jsonb, 'Demo Android', 157940, 210940, 13, 'Excellent', '{"cpu":{"label":{"ar":"المعالج","fr":"Processeur"},"value":"SoC","choices":[]},"ram":{"label":{"ar":"الذاكرة","fr":"Mémoire RAM"},"value":"6 GB","choices":[]},"storage":{"label":{"ar":"التخزين","fr":"Stockage"},"value":"256 GB","choices":[]},"screen":{"label":{"ar":"حجم الشاشة","fr":"Taille d’écran"},"value":"6.1\"","choices":["5.8\"","6.1\"","6.7\""]},"keyboard":{"label":{"ar":"لوحة المفاتيح","fr":"Clavier"},"value":null,"choices":[]},"condition":{"label":{"ar":"الحالة","fr":"État"},"value":"Excellent","choices":[]},"battery":{"label":{"ar":"صحة البطارية","fr":"Santé de la batterie"},"value":"96%","choices":[]}}'::jsonb, '["assets/products/android-flagship-256.svg"]'::jsonb, true, 'RS-0005', 0, '{"type":"Smartphone","discount":25,"colors":[{"name":"Graphite","hex":"#374151"}],"options":[{"name":"Storage","values":["256 GB"]}],"available":true,"body":"","battery":96,"description":{"ar":"هاتف مجدد بالكامل، تم فحصه وتنظيفه واختباره من طرف خبراء متجر تجريبي. يعمل بكفاءة عالية ويأتي بضمان 12 شهرًا.","fr":"Téléphone entièrement reconditionné, inspecté, nettoyé et testé par les experts Demo Store. Il fonctionne parfaitement et bénéficie d’une garantie de 12 mois."},"includes":[{"ar":"الهاتف","fr":"Téléphone"},{"ar":"كابل الشحن","fr":"Câble de charge"},{"ar":"أداة إخراج الشريحة","fr":"Outil SIM"}],"colorImages":{"Graphite":"assets/products/android-flagship-256.svg"},"colorRemote":{},"warrantyMonths":12,"lowStock":false,"collections":["android","special-offers"],"image":"assets/products/android-flagship-256.svg"}'::jsonb) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1010', 'android-flagship-256', null, null, null, 0, 13) on conflict (id) do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('android', 'android-flagship-256', 0) on conflict do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('special-offers', 'android-flagship-256', 1) on conflict do nothing;
insert into public.restore_products (id, handle, title, brand, price, compare_at, stock, condition, specs, images, active, sku, sort_order, extra) values ('android-fold', 'android-fold', '{"ar":"Android Fold","fr":"Android Fold"}'::jsonb, 'Demo Android', 263940, null, 4, 'Good', '{"cpu":{"label":{"ar":"المعالج","fr":"Processeur"},"value":"SoC","choices":[]},"ram":{"label":{"ar":"الذاكرة","fr":"Mémoire RAM"},"value":"6 GB","choices":[]},"storage":{"label":{"ar":"التخزين","fr":"Stockage"},"value":"256 GB","choices":[]},"screen":{"label":{"ar":"حجم الشاشة","fr":"Taille d’écran"},"value":"6.1\"","choices":["5.8\"","6.1\"","6.7\""]},"keyboard":{"label":{"ar":"لوحة المفاتيح","fr":"Clavier"},"value":null,"choices":[]},"condition":{"label":{"ar":"الحالة","fr":"État"},"value":"Excellent","choices":[]},"battery":{"label":{"ar":"صحة البطارية","fr":"Santé de la batterie"},"value":"99%","choices":[]}}'::jsonb, '["assets/products/android-fold.svg"]'::jsonb, true, 'RS-0006', 0, '{"type":"Smartphone","discount":0,"colors":[],"options":[{"name":"Storage","values":["256 GB","512 GB"]}],"available":true,"body":"","battery":99,"description":{"ar":"هاتف مجدد بالكامل، تم فحصه وتنظيفه واختباره من طرف خبراء متجر تجريبي. يعمل بكفاءة عالية ويأتي بضمان 12 شهرًا.","fr":"Téléphone entièrement reconditionné, inspecté, nettoyé et testé par les experts Demo Store. Il fonctionne parfaitement et bénéficie d’une garantie de 12 mois."},"includes":[{"ar":"الهاتف","fr":"Téléphone"},{"ar":"كابل الشحن","fr":"Câble de charge"},{"ar":"أداة إخراج الشريحة","fr":"Outil SIM"}],"colorImages":{},"colorRemote":{},"warrantyMonths":12,"lowStock":false,"collections":["android"],"image":"assets/products/android-fold.svg"}'::jsonb) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1011', 'android-fold', null, null, null, 0, 4) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1012', 'android-fold', null, null, null, 31675, 4) on conflict (id) do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('android', 'android-fold', 0) on conflict do nothing;
insert into public.restore_products (id, handle, title, brand, price, compare_at, stock, condition, specs, images, active, sku, sort_order, extra) values ('android-note', 'android-note', '{"ar":"Android Note","fr":"Android Note"}'::jsonb, 'Demo Android', 104940, 136740, 3, 'Excellent', '{"cpu":{"label":{"ar":"المعالج","fr":"Processeur"},"value":"SoC","choices":[]},"ram":{"label":{"ar":"الذاكرة","fr":"Mémoire RAM"},"value":"6 GB","choices":[]},"storage":{"label":{"ar":"التخزين","fr":"Stockage"},"value":"128 GB","choices":[]},"screen":{"label":{"ar":"حجم الشاشة","fr":"Taille d’écran"},"value":"6.1\"","choices":["5.8\"","6.1\"","6.7\""]},"keyboard":{"label":{"ar":"لوحة المفاتيح","fr":"Clavier"},"value":null,"choices":[]},"condition":{"label":{"ar":"الحالة","fr":"État"},"value":"Excellent","choices":[]},"battery":{"label":{"ar":"صحة البطارية","fr":"Santé de la batterie"},"value":"84%","choices":[]}}'::jsonb, '["assets/products/android-note.svg"]'::jsonb, true, 'RS-0007', 0, '{"type":"Smartphone","discount":23,"colors":[],"options":[{"name":"Storage","values":["128 GB"]}],"available":true,"body":"","battery":84,"description":{"ar":"هاتف مجدد بالكامل، تم فحصه وتنظيفه واختباره من طرف خبراء متجر تجريبي. يعمل بكفاءة عالية ويأتي بضمان 12 شهرًا.","fr":"Téléphone entièrement reconditionné, inspecté, nettoyé et testé par les experts Demo Store. Il fonctionne parfaitement et bénéficie d’une garantie de 12 mois."},"includes":[{"ar":"الهاتف","fr":"Téléphone"},{"ar":"كابل الشحن","fr":"Câble de charge"},{"ar":"أداة إخراج الشريحة","fr":"Outil SIM"}],"colorImages":{},"colorRemote":{},"warrantyMonths":12,"lowStock":false,"collections":["android"],"image":"assets/products/android-note.svg"}'::jsonb) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1013', 'android-note', null, null, null, 0, 3) on conflict (id) do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('android', 'android-note', 0) on conflict do nothing;
insert into public.restore_products (id, handle, title, brand, price, compare_at, stock, condition, specs, images, active, sku, sort_order, extra) values ('android-budget', 'android-budget', '{"ar":"Android Budget","fr":"Android Budget"}'::jsonb, 'Demo Android', 41340, 51940, 7, 'Excellent', '{"cpu":{"label":{"ar":"المعالج","fr":"Processeur"},"value":"SoC","choices":[]},"ram":{"label":{"ar":"الذاكرة","fr":"Mémoire RAM"},"value":"6 GB","choices":[]},"storage":{"label":{"ar":"التخزين","fr":"Stockage"},"value":"64 GB","choices":[]},"screen":{"label":{"ar":"حجم الشاشة","fr":"Taille d’écran"},"value":"6.1\"","choices":["5.8\"","6.1\"","6.7\""]},"keyboard":{"label":{"ar":"لوحة المفاتيح","fr":"Clavier"},"value":null,"choices":[]},"condition":{"label":{"ar":"الحالة","fr":"État"},"value":"Excellent","choices":[]},"battery":{"label":{"ar":"صحة البطارية","fr":"Santé de la batterie"},"value":"87%","choices":[]}}'::jsonb, '["assets/products/android-budget.svg"]'::jsonb, true, 'RS-0008', 0, '{"type":"Smartphone","discount":20,"colors":[],"options":[{"name":"Storage","values":["64 GB"]}],"available":true,"body":"","battery":87,"description":{"ar":"هاتف مجدد بالكامل، تم فحصه وتنظيفه واختباره من طرف خبراء متجر تجريبي. يعمل بكفاءة عالية ويأتي بضمان 12 شهرًا.","fr":"Téléphone entièrement reconditionné, inspecté, nettoyé et testé par les experts Demo Store. Il fonctionne parfaitement et bénéficie d’une garantie de 12 mois."},"includes":[{"ar":"الهاتف","fr":"Téléphone"},{"ar":"كابل الشحن","fr":"Câble de charge"},{"ar":"أداة إخراج الشريحة","fr":"Outil SIM"}],"colorImages":{},"colorRemote":{},"warrantyMonths":12,"lowStock":false,"collections":["android","special-offers"],"image":"assets/products/android-budget.svg"}'::jsonb) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1014', 'android-budget', null, null, null, 0, 7) on conflict (id) do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('android', 'android-budget', 0) on conflict do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('special-offers', 'android-budget', 1) on conflict do nothing;
insert into public.restore_products (id, handle, title, brand, price, compare_at, stock, condition, specs, images, active, sku, sort_order, extra) values ('laptop-business-14', 'laptop-business-14', '{"ar":"Business Laptop 14\"","fr":"Business Laptop 14\""}'::jsonb, 'Demo Computers', 168540, 232140, 5, 'Excellent', '{"cpu":{"label":{"ar":"المعالج","fr":"Processeur"},"value":"Intel Core i5","choices":["Intel Core i5","Intel Core i7","Intel Core i5","Apple M1","Apple M2"]},"ram":{"label":{"ar":"الذاكرة","fr":"Mémoire RAM"},"value":"8 GB","choices":["8 GB","8 GB","16 GB","32 GB"]},"storage":{"label":{"ar":"التخزين","fr":"Stockage"},"value":"256 GB SSD","choices":[]},"screen":{"label":{"ar":"حجم الشاشة","fr":"Taille d’écran"},"value":"14\"","choices":["14\"","13.3\"","14\"","15.6\"","16\""]},"keyboard":{"label":{"ar":"لوحة المفاتيح","fr":"Clavier"},"value":{"ar":"فرنسي AZERTY","fr":"Français AZERTY"},"choices":["Français AZERTY","QWERTY (US)","Arabe / Anglais"]},"condition":{"label":{"ar":"الحالة","fr":"État"},"value":"Excellent","choices":[]},"battery":{"label":{"ar":"صحة البطارية","fr":"Santé de la batterie"},"value":"92%","choices":[]}}'::jsonb, '["assets/products/laptop-business-14.svg"]'::jsonb, true, 'RS-0009', 0, '{"type":"Laptop","discount":27,"colors":[],"options":[{"name":"RAM","values":["8 GB","16 GB"]},{"name":"SSD","values":["256 GB","512 GB"]}],"available":true,"body":"","battery":null,"description":{"ar":"حاسوب محمول مجدد تم اختباره مكونًا بمكون. يصلح للعمل والدراسة والاستخدام اليومي، مع ضمان 12 شهرًا.","fr":"Ordinateur portable reconditionné, testé composant par composant. Idéal pour le travail, les études et l’usage quotidien, avec 12 mois de garantie."},"includes":[{"ar":"الحاسوب المحمول","fr":"Ordinateur portable"},{"ar":"الشاحن","fr":"Chargeur"},{"ar":"كابل الطاقة","fr":"Câble d’alimentation"}],"colorImages":{},"colorRemote":{},"warrantyMonths":12,"lowStock":false,"collections":["laptops","special-offers"],"image":"assets/products/laptop-business-14.svg"}'::jsonb) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1015', 'laptop-business-14', null, null, null, 0, 5) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1016', 'laptop-business-14', null, null, null, 20225, 5) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1017', 'laptop-business-14', null, null, null, 20225, 5) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1018', 'laptop-business-14', null, null, null, 40450, 5) on conflict (id) do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('laptops', 'laptop-business-14', 0) on conflict do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('special-offers', 'laptop-business-14', 1) on conflict do nothing;
insert into public.restore_products (id, handle, title, brand, price, compare_at, stock, condition, specs, images, active, sku, sort_order, extra) values ('laptop-ultrabook-13', 'laptop-ultrabook-13', '{"ar":"Ultrabook 13\"","fr":"Ultrabook 13\""}'::jsonb, 'Demo Computers', 210940, null, 6, 'Good', '{"cpu":{"label":{"ar":"المعالج","fr":"Processeur"},"value":"Intel Core i5","choices":["Intel Core i5","Intel Core i7","Intel Core i5","Apple M1","Apple M2"]},"ram":{"label":{"ar":"الذاكرة","fr":"Mémoire RAM"},"value":"16 GB","choices":["16 GB","8 GB","16 GB","32 GB"]},"storage":{"label":{"ar":"التخزين","fr":"Stockage"},"value":"256 GB SSD","choices":[]},"screen":{"label":{"ar":"حجم الشاشة","fr":"Taille d’écran"},"value":"14\"","choices":["14\"","13.3\"","14\"","15.6\"","16\""]},"keyboard":{"label":{"ar":"لوحة المفاتيح","fr":"Clavier"},"value":{"ar":"فرنسي AZERTY","fr":"Français AZERTY"},"choices":["Français AZERTY","QWERTY (US)","Arabe / Anglais"]},"condition":{"label":{"ar":"الحالة","fr":"État"},"value":"Excellent","choices":[]},"battery":{"label":{"ar":"صحة البطارية","fr":"Santé de la batterie"},"value":"92%","choices":[]}}'::jsonb, '["assets/products/laptop-ultrabook-13.svg"]'::jsonb, true, 'RS-0010', 0, '{"type":"Laptop","discount":0,"colors":[],"options":[{"name":"RAM","values":["16 GB"]}],"available":true,"body":"","battery":null,"description":{"ar":"حاسوب محمول مجدد تم اختباره مكونًا بمكون. يصلح للعمل والدراسة والاستخدام اليومي، مع ضمان 12 شهرًا.","fr":"Ordinateur portable reconditionné, testé composant par composant. Idéal pour le travail, les études et l’usage quotidien, avec 12 mois de garantie."},"includes":[{"ar":"الحاسوب المحمول","fr":"Ordinateur portable"},{"ar":"الشاحن","fr":"Chargeur"},{"ar":"كابل الطاقة","fr":"Câble d’alimentation"}],"colorImages":{},"colorRemote":{},"warrantyMonths":12,"lowStock":false,"collections":["laptops"],"image":"assets/products/laptop-ultrabook-13.svg"}'::jsonb) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1019', 'laptop-ultrabook-13', null, null, null, 0, 6) on conflict (id) do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('laptops', 'laptop-ultrabook-13', 0) on conflict do nothing;
insert into public.restore_products (id, handle, title, brand, price, compare_at, stock, condition, specs, images, active, sku, sort_order, extra) values ('laptop-student-15', 'laptop-student-15', '{"ar":"Student Laptop 15\"","fr":"Student Laptop 15\""}'::jsonb, 'Demo Computers', 104940, 136740, 16, 'Excellent', '{"cpu":{"label":{"ar":"المعالج","fr":"Processeur"},"value":"Intel Core i5","choices":["Intel Core i5","Intel Core i7","Intel Core i5","Apple M1","Apple M2"]},"ram":{"label":{"ar":"الذاكرة","fr":"Mémoire RAM"},"value":"8 GB","choices":["8 GB","8 GB","16 GB","32 GB"]},"storage":{"label":{"ar":"التخزين","fr":"Stockage"},"value":"256 GB SSD","choices":[]},"screen":{"label":{"ar":"حجم الشاشة","fr":"Taille d’écran"},"value":"14\"","choices":["14\"","13.3\"","14\"","15.6\"","16\""]},"keyboard":{"label":{"ar":"لوحة المفاتيح","fr":"Clavier"},"value":{"ar":"فرنسي AZERTY","fr":"Français AZERTY"},"choices":["Français AZERTY","QWERTY (US)","Arabe / Anglais"]},"condition":{"label":{"ar":"الحالة","fr":"État"},"value":"Excellent","choices":[]},"battery":{"label":{"ar":"صحة البطارية","fr":"Santé de la batterie"},"value":"92%","choices":[]}}'::jsonb, '["assets/products/laptop-student-15.svg"]'::jsonb, true, 'RS-0011', 0, '{"type":"Laptop","discount":23,"colors":[],"options":[{"name":"RAM","values":["8 GB"]}],"available":true,"body":"","battery":null,"description":{"ar":"حاسوب محمول مجدد تم اختباره مكونًا بمكون. يصلح للعمل والدراسة والاستخدام اليومي، مع ضمان 12 شهرًا.","fr":"Ordinateur portable reconditionné, testé composant par composant. Idéal pour le travail, les études et l’usage quotidien, avec 12 mois de garantie."},"includes":[{"ar":"الحاسوب المحمول","fr":"Ordinateur portable"},{"ar":"الشاحن","fr":"Chargeur"},{"ar":"كابل الطاقة","fr":"Câble d’alimentation"}],"colorImages":{},"colorRemote":{},"warrantyMonths":12,"lowStock":false,"collections":["laptops"],"image":"assets/products/laptop-student-15.svg"}'::jsonb) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1020', 'laptop-student-15', null, null, null, 0, 16) on conflict (id) do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('laptops', 'laptop-student-15', 0) on conflict do nothing;
insert into public.restore_products (id, handle, title, brand, price, compare_at, stock, condition, specs, images, active, sku, sort_order, extra) values ('laptop-creator-16', 'laptop-creator-16', '{"ar":"Creator Laptop 16\"","fr":"Creator Laptop 16\""}'::jsonb, 'Demo Computers', 348740, 422940, 13, 'Excellent', '{"cpu":{"label":{"ar":"المعالج","fr":"Processeur"},"value":"Apple Silicon","choices":["Apple Silicon","Intel Core i7","Intel Core i5","Apple M1","Apple M2"]},"ram":{"label":{"ar":"الذاكرة","fr":"Mémoire RAM"},"value":"16 GB","choices":["16 GB","8 GB","16 GB","32 GB"]},"storage":{"label":{"ar":"التخزين","fr":"Stockage"},"value":"256 GB SSD","choices":[]},"screen":{"label":{"ar":"حجم الشاشة","fr":"Taille d’écran"},"value":"13.3\"","choices":["13.3\"","13.3\"","14\"","15.6\"","16\""]},"keyboard":{"label":{"ar":"لوحة المفاتيح","fr":"Clavier"},"value":{"ar":"فرنسي AZERTY","fr":"Français AZERTY"},"choices":["Français AZERTY","QWERTY (US)","Arabe / Anglais"]},"condition":{"label":{"ar":"الحالة","fr":"État"},"value":"Excellent","choices":[]},"battery":{"label":{"ar":"صحة البطارية","fr":"Santé de la batterie"},"value":"92%","choices":[]}}'::jsonb, '["assets/products/laptop-creator-16.svg"]'::jsonb, true, 'RS-0012', 0, '{"type":"Macbook","discount":18,"colors":[],"options":[{"name":"RAM","values":["16 GB","32 GB"]}],"available":true,"body":"","battery":null,"description":{"ar":"MacBook مجدد مع macOS مثبت وجاهز للاستخدام. تم فحص البطارية ولوحة المفاتيح والمنافذ بواسطة خبراء متجر تجريبي.","fr":"MacBook reconditionné avec macOS installé et prêt à l’emploi. Batterie, clavier et ports vérifiés par les experts Demo Store."},"includes":[{"ar":"جهاز MacBook","fr":"MacBook"},{"ar":"شاحن أصلي","fr":"Chargeur d’origine"},{"ar":"كابل USB-C","fr":"Câble USB-C"}],"colorImages":{},"colorRemote":{},"warrantyMonths":12,"lowStock":false,"collections":["laptops","macbooks"],"image":"assets/products/laptop-creator-16.svg"}'::jsonb) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1021', 'laptop-creator-16', null, null, null, 0, 13) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1022', 'laptop-creator-16', null, null, null, 41850, 13) on conflict (id) do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('laptops', 'laptop-creator-16', 0) on conflict do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('macbooks', 'laptop-creator-16', 1) on conflict do nothing;
insert into public.restore_products (id, handle, title, brand, price, compare_at, stock, condition, specs, images, active, sku, sort_order, extra) values ('tablet-10', 'tablet-10', '{"ar":"Tablet 10\"","fr":"Tablet 10\""}'::jsonb, 'Demo Tablets', 83740, 104940, 8, 'Excellent', '{"cpu":{"label":{"ar":"المعالج","fr":"Processeur"},"value":"—","choices":[]},"ram":{"label":{"ar":"الذاكرة","fr":"Mémoire RAM"},"value":"—","choices":[]},"storage":{"label":{"ar":"التخزين","fr":"Stockage"},"value":"64 GB","choices":[]},"screen":{"label":{"ar":"حجم الشاشة","fr":"Taille d’écran"},"value":"10.2\"","choices":[]},"keyboard":{"label":{"ar":"لوحة المفاتيح","fr":"Clavier"},"value":null,"choices":[]},"condition":{"label":{"ar":"الحالة","fr":"État"},"value":"Excellent","choices":[]},"battery":{"label":{"ar":"صحة البطارية","fr":"Santé de la batterie"},"value":"92%","choices":[]}}'::jsonb, '["assets/products/tablet-10.svg"]'::jsonb, true, 'RS-0013', 0, '{"type":"Tablets","discount":20,"colors":[],"options":[{"name":"Storage","values":["64 GB","256 GB"]}],"available":true,"body":"","battery":null,"description":{"ar":"جهاز لوحي مجدد تم فحصه بالكامل، مناسب للقراءة والعمل والترفيه، ويأتي بضمان 12 شهرًا.","fr":"Tablette reconditionnée entièrement vérifiée, idéale pour lire, travailler et se divertir, avec 12 mois de garantie."},"includes":[{"ar":"الجهاز اللوحي","fr":"Tablette"},{"ar":"كابل الشحن","fr":"Câble de charge"},{"ar":"الشاحن","fr":"Chargeur"}],"colorImages":{},"colorRemote":{},"warrantyMonths":12,"lowStock":false,"collections":["tablets"],"image":"assets/products/tablet-10.svg"}'::jsonb) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1023', 'tablet-10', null, null, null, 0, 8) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1024', 'tablet-10', null, null, null, 10050, 8) on conflict (id) do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('tablets', 'tablet-10', 0) on conflict do nothing;
insert into public.restore_products (id, handle, title, brand, price, compare_at, stock, condition, specs, images, active, sku, sort_order, extra) values ('smartwatch-s', 'smartwatch-s', '{"ar":"Smartwatch S","fr":"Smartwatch S"}'::jsonb, 'Demo Wear', 51940, 73140, 9, 'Excellent', '{"cpu":{"label":{"ar":"المعالج","fr":"Processeur"},"value":"—","choices":[]},"ram":{"label":{"ar":"الذاكرة","fr":"Mémoire RAM"},"value":"—","choices":[]},"storage":{"label":{"ar":"التخزين","fr":"Stockage"},"value":"—","choices":[]},"screen":{"label":{"ar":"حجم الشاشة","fr":"Taille d’écran"},"value":"—","choices":[]},"keyboard":{"label":{"ar":"لوحة المفاتيح","fr":"Clavier"},"value":null,"choices":[]},"condition":{"label":{"ar":"الحالة","fr":"État"},"value":"Excellent","choices":[]},"battery":{"label":{"ar":"صحة البطارية","fr":"Santé de la batterie"},"value":"92%","choices":[]}}'::jsonb, '["assets/products/smartwatch-s.svg"]'::jsonb, true, 'RS-0014', 0, '{"type":"Watch","discount":29,"colors":[],"options":[{"name":"Size","values":["41 mm","45 mm"]}],"available":true,"body":"","battery":null,"description":{"ar":"جهاز مجدد تم فحصه واختباره من طرف خبراء متجر تجريبي، ويأتي بضمان 12 شهرًا.","fr":"Appareil reconditionné, inspecté et testé par les experts Demo Store, avec 12 mois de garantie."},"includes":[{"ar":"الجهاز","fr":"Appareil"},{"ar":"الكابل","fr":"Câble"}],"colorImages":{},"colorRemote":{},"warrantyMonths":12,"lowStock":false,"collections":["watches"],"image":"assets/products/smartwatch-s.svg"}'::jsonb) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1025', 'smartwatch-s', null, null, null, 0, 9) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1026', 'smartwatch-s', null, null, null, 6235, 9) on conflict (id) do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('watches', 'smartwatch-s', 0) on conflict do nothing;
insert into public.restore_products (id, handle, title, brand, price, compare_at, stock, condition, specs, images, active, sku, sort_order, extra) values ('wireless-earbuds', 'wireless-earbuds', '{"ar":"Wireless Earbuds","fr":"Wireless Earbuds"}'::jsonb, 'Demo Audio', 20140, 30740, 2, 'Excellent', '{"cpu":{"label":{"ar":"المعالج","fr":"Processeur"},"value":"—","choices":[]},"ram":{"label":{"ar":"الذاكرة","fr":"Mémoire RAM"},"value":"—","choices":[]},"storage":{"label":{"ar":"التخزين","fr":"Stockage"},"value":"—","choices":[]},"screen":{"label":{"ar":"حجم الشاشة","fr":"Taille d’écran"},"value":"—","choices":[]},"keyboard":{"label":{"ar":"لوحة المفاتيح","fr":"Clavier"},"value":null,"choices":[]},"condition":{"label":{"ar":"الحالة","fr":"État"},"value":"Excellent","choices":[]},"battery":{"label":{"ar":"صحة البطارية","fr":"Santé de la batterie"},"value":"92%","choices":[]}}'::jsonb, '["assets/products/wireless-earbuds.svg"]'::jsonb, true, 'RS-0015', 0, '{"type":"Audio","discount":34,"colors":[],"options":[{"name":"Color","values":["White","Black"]}],"available":true,"body":"","battery":null,"description":{"ar":"جهاز مجدد تم فحصه واختباره من طرف خبراء متجر تجريبي، ويأتي بضمان 12 شهرًا.","fr":"Appareil reconditionné, inspecté et testé par les experts Demo Store, avec 12 mois de garantie."},"includes":[{"ar":"الجهاز","fr":"Appareil"},{"ar":"الكابل","fr":"Câble"}],"colorImages":{},"colorRemote":{},"warrantyMonths":12,"lowStock":true,"collections":["audio","special-offers"],"image":"assets/products/wireless-earbuds.svg"}'::jsonb) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1027', 'wireless-earbuds', null, null, null, 0, 2) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1028', 'wireless-earbuds', null, null, null, 2415, 2) on conflict (id) do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('audio', 'wireless-earbuds', 0) on conflict do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('special-offers', 'wireless-earbuds', 1) on conflict do nothing;
insert into public.restore_products (id, handle, title, brand, price, compare_at, stock, condition, specs, images, active, sku, sort_order, extra) values ('headphones-anc', 'headphones-anc', '{"ar":"ANC Headphones","fr":"ANC Headphones"}'::jsonb, 'Demo Audio', 41340, null, 14, 'Good', '{"cpu":{"label":{"ar":"المعالج","fr":"Processeur"},"value":"—","choices":[]},"ram":{"label":{"ar":"الذاكرة","fr":"Mémoire RAM"},"value":"—","choices":[]},"storage":{"label":{"ar":"التخزين","fr":"Stockage"},"value":"—","choices":[]},"screen":{"label":{"ar":"حجم الشاشة","fr":"Taille d’écran"},"value":"—","choices":[]},"keyboard":{"label":{"ar":"لوحة المفاتيح","fr":"Clavier"},"value":null,"choices":[]},"condition":{"label":{"ar":"الحالة","fr":"État"},"value":"Excellent","choices":[]},"battery":{"label":{"ar":"صحة البطارية","fr":"Santé de la batterie"},"value":"92%","choices":[]}}'::jsonb, '["assets/products/headphones-anc.svg"]'::jsonb, true, 'RS-0016', 0, '{"type":"Audio","discount":0,"colors":[],"options":[{"name":"Color","values":["Black"]}],"available":true,"body":"","battery":null,"description":{"ar":"جهاز مجدد تم فحصه واختباره من طرف خبراء متجر تجريبي، ويأتي بضمان 12 شهرًا.","fr":"Appareil reconditionné, inspecté et testé par les experts Demo Store, avec 12 mois de garantie."},"includes":[{"ar":"الجهاز","fr":"Appareil"},{"ar":"الكابل","fr":"Câble"}],"colorImages":{},"colorRemote":{},"warrantyMonths":12,"lowStock":false,"collections":["audio"],"image":"assets/products/headphones-anc.svg"}'::jsonb) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1029', 'headphones-anc', null, null, null, 0, 14) on conflict (id) do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('audio', 'headphones-anc', 0) on conflict do nothing;
insert into public.restore_products (id, handle, title, brand, price, compare_at, stock, condition, specs, images, active, sku, sort_order, extra) values ('fast-charger-65w', 'fast-charger-65w', '{"ar":"Fast Charger 65 W","fr":"Fast Charger 65 W"}'::jsonb, 'Demo Power', 9540, 12720, 13, 'Excellent', '{"cpu":{"label":{"ar":"المعالج","fr":"Processeur"},"value":"—","choices":[]},"ram":{"label":{"ar":"الذاكرة","fr":"Mémoire RAM"},"value":"—","choices":[]},"storage":{"label":{"ar":"التخزين","fr":"Stockage"},"value":"—","choices":[]},"screen":{"label":{"ar":"حجم الشاشة","fr":"Taille d’écran"},"value":"—","choices":[]},"keyboard":{"label":{"ar":"لوحة المفاتيح","fr":"Clavier"},"value":null,"choices":[]},"condition":{"label":{"ar":"الحالة","fr":"État"},"value":"Excellent","choices":[]},"battery":{"label":{"ar":"صحة البطارية","fr":"Santé de la batterie"},"value":"92%","choices":[]}}'::jsonb, '["assets/products/fast-charger-65w.svg"]'::jsonb, true, 'RS-0017', 0, '{"type":"Charger","discount":25,"colors":[],"options":[{"name":"Plug","values":["EU"]}],"available":true,"body":"","battery":null,"description":{"ar":"جهاز مجدد تم فحصه واختباره من طرف خبراء متجر تجريبي، ويأتي بضمان 12 شهرًا.","fr":"Appareil reconditionné, inspecté et testé par les experts Demo Store, avec 12 mois de garantie."},"includes":[{"ar":"الجهاز","fr":"Appareil"},{"ar":"الكابل","fr":"Câble"}],"colorImages":{},"colorRemote":{},"warrantyMonths":12,"lowStock":false,"collections":["chargers"],"image":"assets/products/fast-charger-65w.svg"}'::jsonb) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1030', 'fast-charger-65w', null, null, null, 0, 13) on conflict (id) do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('chargers', 'fast-charger-65w', 0) on conflict do nothing;
insert into public.restore_products (id, handle, title, brand, price, compare_at, stock, condition, specs, images, active, sku, sort_order, extra) values ('power-bank-20000', 'power-bank-20000', '{"ar":"Power Bank 20 000 mAh","fr":"Power Bank 20 000 mAh"}'::jsonb, 'Demo Power', 15900, null, 6, 'Good', '{"cpu":{"label":{"ar":"المعالج","fr":"Processeur"},"value":"—","choices":[]},"ram":{"label":{"ar":"الذاكرة","fr":"Mémoire RAM"},"value":"—","choices":[]},"storage":{"label":{"ar":"التخزين","fr":"Stockage"},"value":"—","choices":[]},"screen":{"label":{"ar":"حجم الشاشة","fr":"Taille d’écran"},"value":"—","choices":[]},"keyboard":{"label":{"ar":"لوحة المفاتيح","fr":"Clavier"},"value":null,"choices":[]},"condition":{"label":{"ar":"الحالة","fr":"État"},"value":"Excellent","choices":[]},"battery":{"label":{"ar":"صحة البطارية","fr":"Santé de la batterie"},"value":"92%","choices":[]}}'::jsonb, '["assets/products/power-bank-20000.svg"]'::jsonb, true, 'RS-0018', 0, '{"type":"Charger","discount":0,"colors":[],"options":[{"name":"Color","values":["Black"]}],"available":true,"body":"","battery":null,"description":{"ar":"جهاز مجدد تم فحصه واختباره من طرف خبراء متجر تجريبي، ويأتي بضمان 12 شهرًا.","fr":"Appareil reconditionné, inspecté et testé par les experts Demo Store, avec 12 mois de garantie."},"includes":[{"ar":"الجهاز","fr":"Appareil"},{"ar":"الكابل","fr":"Câble"}],"colorImages":{},"colorRemote":{},"warrantyMonths":12,"lowStock":false,"collections":["chargers"],"image":"assets/products/power-bank-20000.svg"}'::jsonb) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1031', 'power-bank-20000', null, null, null, 0, 6) on conflict (id) do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('chargers', 'power-bank-20000', 0) on conflict do nothing;
insert into public.restore_products (id, handle, title, brand, price, compare_at, stock, condition, specs, images, active, sku, sort_order, extra) values ('game-controller', 'game-controller', '{"ar":"Game Controller","fr":"Game Controller"}'::jsonb, 'Demo Play', 25440, 30740, 5, 'Excellent', '{"cpu":{"label":{"ar":"المعالج","fr":"Processeur"},"value":"—","choices":[]},"ram":{"label":{"ar":"الذاكرة","fr":"Mémoire RAM"},"value":"—","choices":[]},"storage":{"label":{"ar":"التخزين","fr":"Stockage"},"value":"—","choices":[]},"screen":{"label":{"ar":"حجم الشاشة","fr":"Taille d’écran"},"value":"—","choices":[]},"keyboard":{"label":{"ar":"لوحة المفاتيح","fr":"Clavier"},"value":null,"choices":[]},"condition":{"label":{"ar":"الحالة","fr":"État"},"value":"Excellent","choices":[]},"battery":{"label":{"ar":"صحة البطارية","fr":"Santé de la batterie"},"value":"92%","choices":[]}}'::jsonb, '["assets/products/game-controller.svg"]'::jsonb, true, 'RS-0019', 0, '{"type":"Gaming","discount":17,"colors":[],"options":[{"name":"Color","values":["Black","White"]}],"available":true,"body":"","battery":null,"description":{"ar":"جهاز مجدد تم فحصه واختباره من طرف خبراء متجر تجريبي، ويأتي بضمان 12 شهرًا.","fr":"Appareil reconditionné, inspecté et testé par les experts Demo Store, avec 12 mois de garantie."},"includes":[{"ar":"الجهاز","fr":"Appareil"},{"ar":"الكابل","fr":"Câble"}],"colorImages":{},"colorRemote":{},"warrantyMonths":12,"lowStock":false,"collections":["gaming"],"image":"assets/products/game-controller.svg"}'::jsonb) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1032', 'game-controller', null, null, null, 0, 5) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1033', 'game-controller', null, null, null, 3055, 5) on conflict (id) do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('gaming', 'game-controller', 0) on conflict do nothing;
insert into public.restore_products (id, handle, title, brand, price, compare_at, stock, condition, specs, images, active, sku, sort_order, extra) values ('clear-case', 'clear-case', '{"ar":"Clear Case","fr":"Clear Case"}'::jsonb, 'Demo Access', 3180, null, 16, 'Good', '{"cpu":{"label":{"ar":"المعالج","fr":"Processeur"},"value":"—","choices":[]},"ram":{"label":{"ar":"الذاكرة","fr":"Mémoire RAM"},"value":"—","choices":[]},"storage":{"label":{"ar":"التخزين","fr":"Stockage"},"value":"—","choices":[]},"screen":{"label":{"ar":"حجم الشاشة","fr":"Taille d’écran"},"value":"—","choices":[]},"keyboard":{"label":{"ar":"لوحة المفاتيح","fr":"Clavier"},"value":null,"choices":[]},"condition":{"label":{"ar":"الحالة","fr":"État"},"value":"Excellent","choices":[]},"battery":{"label":{"ar":"صحة البطارية","fr":"Santé de la batterie"},"value":"92%","choices":[]}}'::jsonb, '["assets/products/clear-case.svg"]'::jsonb, true, 'RS-0020', 0, '{"type":"Accessories","discount":0,"colors":[],"options":[{"name":"Model","values":["Pro","Lite","Max"]}],"available":true,"body":"","battery":null,"description":{"ar":"ملحق أصلي مجدد أو جديد، تم فحصه لضمان التوافق والجودة.","fr":"Accessoire d’origine reconditionné ou neuf, contrôlé pour garantir compatibilité et qualité."},"includes":[{"ar":"الملحق","fr":"Accessoire"},{"ar":"دليل الاستخدام","fr":"Guide d’utilisation"}],"colorImages":{},"colorRemote":{},"warrantyMonths":12,"lowStock":false,"collections":["accessories"],"image":"assets/products/clear-case.svg"}'::jsonb) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1034', 'clear-case', null, null, null, 0, 16) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1035', 'clear-case', null, null, null, 380, 16) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1036', 'clear-case', null, null, null, 765, 16) on conflict (id) do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('accessories', 'clear-case', 0) on conflict do nothing;
insert into public.restore_products (id, handle, title, brand, price, compare_at, stock, condition, specs, images, active, sku, sort_order, extra) values ('screen-protector', 'screen-protector', '{"ar":"Tempered Glass","fr":"Tempered Glass"}'::jsonb, 'Demo Access', 2650, 4240, 9, 'Excellent', '{"cpu":{"label":{"ar":"المعالج","fr":"Processeur"},"value":"—","choices":[]},"ram":{"label":{"ar":"الذاكرة","fr":"Mémoire RAM"},"value":"—","choices":[]},"storage":{"label":{"ar":"التخزين","fr":"Stockage"},"value":"—","choices":[]},"screen":{"label":{"ar":"حجم الشاشة","fr":"Taille d’écran"},"value":"—","choices":[]},"keyboard":{"label":{"ar":"لوحة المفاتيح","fr":"Clavier"},"value":null,"choices":[]},"condition":{"label":{"ar":"الحالة","fr":"État"},"value":"Excellent","choices":[]},"battery":{"label":{"ar":"صحة البطارية","fr":"Santé de la batterie"},"value":"92%","choices":[]}}'::jsonb, '["assets/products/screen-protector.svg"]'::jsonb, true, 'RS-0021', 0, '{"type":"Accessories","discount":38,"colors":[],"options":[{"name":"Model","values":["Pro","Lite"]}],"available":true,"body":"","battery":null,"description":{"ar":"ملحق أصلي مجدد أو جديد، تم فحصه لضمان التوافق والجودة.","fr":"Accessoire d’origine reconditionné ou neuf, contrôlé pour garantir compatibilité et qualité."},"includes":[{"ar":"الملحق","fr":"Accessoire"},{"ar":"دليل الاستخدام","fr":"Guide d’utilisation"}],"colorImages":{},"colorRemote":{},"warrantyMonths":12,"lowStock":false,"collections":["accessories","special-offers"],"image":"assets/products/screen-protector.svg"}'::jsonb) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1037', 'screen-protector', null, null, null, 0, 9) on conflict (id) do nothing;
insert into public.restore_product_variants (id, product_id, sku, color, storage, price_delta, stock) values ('1038', 'screen-protector', null, null, null, 320, 9) on conflict (id) do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('accessories', 'screen-protector', 0) on conflict do nothing;
insert into public.restore_collection_products (collection_id, product_id, sort_order) values ('special-offers', 'screen-protector', 1) on conflict do nothing;
insert into public.restore_coupons (code, type, value, min_total, expires_at, usage_limit, active, extra) values ('WELCOME10', 'percent', 10, 0, null, null, true, '{"id":"c1"}'::jsonb) on conflict (code) do nothing;
insert into public.restore_coupons (code, type, value, min_total, expires_at, usage_limit, active, extra) values ('NOUAKCHOTT5', 'percent', 5, 10000, null, null, true, '{"id":"c2"}'::jsonb) on conflict (code) do nothing;
update public.restore_catalog_meta set version = version + 1, updated_at = now() where id = 'main';
commit;
-- seed summary: 21 products, 38 variants, 11 collections, 2 coupons
