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
