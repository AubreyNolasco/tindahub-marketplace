-- get_secure_order_unit_price() does not exist on this database (it was
-- only ever defined in an untracked loose SQL file that was never fully
-- applied). Make quote_order() compute reseller/retail unit pricing inline
-- instead of depending on a function that isn't deployed, mirroring the
-- same wholesale_price + quantity-tier logic the client already uses in
-- src/utils/pricing.js (getResellerUnitPrice / getUnitPrice).
create or replace function public.quote_order(p_merchant_id uuid,p_items jsonb,p_shipping_fee numeric default 0)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare buyer uuid:=auth.uid(); buyer_role public.user_role; item jsonb; p public.products; qty integer; unit_price numeric(12,2); subtotal numeric(12,2):=0; reseller_fee numeric(12,2):=0; merchant_fee numeric(12,2); settings public.revenue_settings;
begin
  if buyer is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_items is null or jsonb_array_length(p_items)=0 then raise exception 'EMPTY_CART'; end if;
  select role into buyer_role from public.profiles where id=buyer;
  select * into settings from public.revenue_settings where id=true;
  for item in select * from jsonb_array_elements(p_items) loop
    select * into p from public.products where id=(item->>'product_id')::uuid and merchant_id=p_merchant_id;
    if p is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
    qty:=(item->>'quantity')::integer;
    if qty is null or qty<1 then raise exception 'INVALID_QUANTITY'; end if;
    unit_price:=case when buyer_role='reseller' and p.wholesale_price>0 then p.wholesale_price else p.price end;
    select least(unit_price,coalesce(min((tier->>'price')::numeric),unit_price)) into unit_price
      from jsonb_array_elements(coalesce(p.discount_tiers,'[]'::jsonb)) tier
      where qty>=coalesce((tier->>'min_qty')::integer,2147483647);
    subtotal:=subtotal+(unit_price*qty);
  end loop;
  if buyer_role='reseller' then reseller_fee:=greatest(settings.reseller_fee_minimum,least(settings.reseller_fee_maximum,round(subtotal*settings.reseller_service_fee_percent/100,2))); end if;
  merchant_fee:=round(subtotal*settings.merchant_success_fee_percent/100,2);
  return jsonb_build_object('subtotal',subtotal,'shipping_fee',coalesce(p_shipping_fee,0),'reseller_fee',reseller_fee,'merchant_fee',merchant_fee,'total',subtotal+coalesce(p_shipping_fee,0)+reseller_fee,'reseller_fee_percent',settings.reseller_service_fee_percent,'merchant_fee_percent',settings.merchant_success_fee_percent,'reseller_fee_minimum',settings.reseller_fee_minimum,'reseller_fee_maximum',settings.reseller_fee_maximum);
end $$;
revoke all on function public.quote_order(uuid,jsonb,numeric) from public,anon;
grant execute on function public.quote_order(uuid,jsonb,numeric) to authenticated;
notify pgrst,'reload schema';
