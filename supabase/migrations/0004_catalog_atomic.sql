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
