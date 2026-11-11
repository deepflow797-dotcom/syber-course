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
