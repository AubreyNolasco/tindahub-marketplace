-- Reseller registration no longer requires an initial wallet top-up
-- submission up front. Per request: let them finish signing up and land
-- in their dashboard, then top up whenever they're ready from the Wallet
-- page (src/components/wallet/TopupModal.jsx already lets any
-- authenticated owner insert a topup_requests row regardless of
-- account_status -- topup_owner_insert's WITH CHECK is just
-- owner_id = auth.uid(), no approval gate).
--
-- try_activate_reseller() is untouched: a Reseller still only becomes
-- account_status='approved' once BOTH ID verification and an approved
-- topup_request exist -- this just changes *when* that topup_request
-- gets created (later, self-service from the wallet page, instead of
-- mandatory during onboarding).

create or replace function public.complete_account_onboarding(
  p_role text, p_phone text, p_address text, p_business_name text default null,
  p_topup_amount numeric default null, p_payment_method text default null,
  p_reference_number text default null, p_proof_url text default null
)
returns public.profiles
language plpgsql security definer set search_path = public, auth as $$
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
    insert into public.merchant_profiles(id,business_name,business_address,status) values(auth.uid(),left(trim(p_business_name),160),left(trim(p_address),500),'pending')
    on conflict(id) do update set business_name=excluded.business_name,business_address=excluded.business_address;
  end if;
  insert into public.wallets(owner_id,balance) values(auth.uid(),0) on conflict(owner_id) do nothing;
  return v_profile;
end; $$;

notify pgrst, 'reload schema';
