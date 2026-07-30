-- Auto-grant every Merchant a free 6-month subscription at signup, and backfill
-- existing merchants who never got one (previously only Admin could grant a
-- subscriptions row, so enforce_active_merchant_subscription() was silently
-- blocking every un-granted merchant from posting products / receiving orders).

create or replace function public.complete_account_onboarding(p_role text, p_phone text, p_address text, p_business_name text default null::text, p_topup_amount numeric default null::numeric, p_payment_method text default null::text, p_reference_number text default null::text, p_proof_url text default null::text)
 returns profiles
 language plpgsql
 security definer
 set search_path to 'public', 'auth'
as $function$
declare v_profile public.profiles;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if p_role not in ('merchant','reseller') then raise exception 'INVALID_ROLE'; end if;
  if not exists(select 1 from auth.users where id=auth.uid() and email is not null and email_confirmed_at is not null) then raise exception 'VERIFIED_EMAIL_REQUIRED'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and onboarding_completed=false) then raise exception 'ONBOARDING_ALREADY_COMPLETED'; end if;
  if char_length(trim(coalesce(p_phone,'')))<7 then raise exception 'VALID_PHONE_REQUIRED'; end if;
  if char_length(trim(coalesce(p_address,'')))<12 then raise exception 'COMPLETE_ADDRESS_REQUIRED'; end if;
  if p_role='merchant' and char_length(trim(coalesce(p_business_name,'')))<2 then raise exception 'BUSINESS_NAME_REQUIRED'; end if;
  perform set_config('app.google_onboarding','true',true);
  update public.profiles set role=p_role::public.user_role,phone=left(trim(p_phone),30),address=left(trim(p_address),500),account_status='pending',onboarding_completed=true,updated_at=now() where id=auth.uid() returning * into v_profile;
  if p_role='merchant' then
    insert into public.merchant_profiles(id,business_name,business_address,status,subscription_active,subscription_expires_at)
    values(auth.uid(),left(trim(p_business_name),160),left(trim(p_address),500),'pending',true,now()+interval '6 months')
    on conflict(id) do update set business_name=excluded.business_name,business_address=excluded.business_address;
    insert into public.subscriptions(owner_id,status,is_free,started_at,expires_at)
    values(auth.uid(),'active',true,now(),now()+interval '6 months')
    on conflict(owner_id) do nothing;
  end if;
  insert into public.wallets(owner_id,balance) values(auth.uid(),0) on conflict(owner_id) do nothing;
  return v_profile;
end; $function$;

-- Backfill: every existing merchant without a subscriptions row yet gets the
-- same free 6-month window starting now, so nobody is instantly locked out.
insert into public.subscriptions(owner_id,status,is_free,started_at,expires_at)
select id,'active',true,now(),now()+interval '6 months'
from public.merchant_profiles
where id not in (select owner_id from public.subscriptions)
on conflict(owner_id) do nothing;

update public.merchant_profiles mp
set subscription_active=true, subscription_expires_at=s.expires_at
from public.subscriptions s
where s.owner_id=mp.id and s.is_free and s.expires_at>now()
  and (mp.subscription_expires_at is null or mp.subscription_expires_at<now());
