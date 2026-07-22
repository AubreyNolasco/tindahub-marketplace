-- Merchant pickup addresses are private. Only the owning merchant can fetch
-- their address. Buyers receive delivery details through the merchant/order
-- workflow without gaining read access to the merchant pickup address.

create or replace function public.get_my_merchant_address()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select business_address
  from public.merchant_profiles
  where id = auth.uid();
$$;

revoke all on function public.get_my_merchant_address() from public, anon;
grant execute on function public.get_my_merchant_address() to authenticated;

-- A table-level SELECT grant overrides column-level restrictions, so replace
-- it with an explicit safe public column list.
revoke select on table public.merchant_profiles from anon, authenticated;
grant select (
  id, business_name, business_description, status, trial_ends_at,
  subscription_active, subscription_expires_at, created_at,
  store_open_time, store_close_time, auto_pause_outside_hours, store_timezone
) on table public.merchant_profiles to anon, authenticated;

-- Detect address-like messages and fragments of the merchant's saved address.
create or replace function public.chat_contains_address_info(p_message text, p_merchant_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_message text := lower(regexp_replace(coalesce(p_message, ''), '[^a-zA-Z0-9 ]', ' ', 'g'));
  v_address text;
  v_token text;
  v_matches integer := 0;
begin
  if v_message ~ '(^| )(address|lokasyon|location|pickup|pick up|delivery|house|unit|building|bldg|floor|street|road|avenue|barangay|brgy|city|province|subdivision|village|phase|block|blk|lot|purok|sitio|postal|zipcode|zip)( |$)'
     and v_message ~ '[0-9]|(^| )(near|beside|across|corner|landmark)( |$)' then
    return true;
  end if;

  if v_message ~ '(^| )(unit|house|building|bldg|floor|block|blk|lot|phase|purok|sitio|barangay|brgy) (no )?[a-z0-9-]+' then
    return true;
  end if;

  select lower(regexp_replace(coalesce(business_address, ''), '[^a-zA-Z0-9 ]', ' ', 'g'))
    into v_address
    from public.merchant_profiles
   where id = p_merchant_id;

  if length(v_address) = 0 then return false; end if;

  for v_token in
    select distinct parts.token
      from regexp_split_to_table(v_address, '[[:space:]]+') as parts(token)
     where length(token) >= 4
       and token not in ('street','road','barangay','city','province','building','phase','block')
  loop
    if position(' ' || v_token || ' ' in ' ' || v_message || ' ') > 0 then
      v_matches := v_matches + 1;
    end if;
  end loop;

  return v_matches >= 3 or (v_matches >= 2 and v_message ~ '[0-9]');
end;
$$;

revoke all on function public.chat_contains_address_info(text, uuid) from public, anon;
grant execute on function public.chat_contains_address_info(text, uuid) to authenticated;

create or replace function public.block_chat_contact_info()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.message := trim(new.message);
  if public.chat_contains_contact_info(new.message) then
    raise exception 'CONTACT_INFO_NOT_ALLOWED_IN_CHAT';
  end if;
  if public.chat_contains_address_info(new.message, new.merchant_id) then
    raise exception 'ADDRESS_NOT_ALLOWED_IN_CHAT';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_chat_contact_info on public.chat_messages;
create trigger trg_block_chat_contact_info
before insert or update of message on public.chat_messages
for each row execute function public.block_chat_contact_info();
