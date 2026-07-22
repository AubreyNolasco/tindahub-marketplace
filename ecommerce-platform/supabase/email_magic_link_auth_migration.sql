-- Provider-neutral profile creation and onboarding for email magic links.
-- Run after the existing Google/auth repair migrations.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public,auth as $$
declare v_provider text:=coalesce(new.raw_app_meta_data->>'provider','email');
begin
  insert into public.profiles(id,full_name,email,avatar_url,provider,role,phone,account_status,onboarding_completed)
  values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),nullif(trim(new.raw_user_meta_data->>'name'),''),split_part(new.email,'@',1)),120),lower(new.email),coalesce(new.raw_user_meta_data->>'avatar_url',new.raw_user_meta_data->>'picture'),v_provider,'reseller','','pending',false)
  on conflict(id) do nothing;
  insert into public.wallets(owner_id,balance) values(new.id,0) on conflict(owner_id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.complete_account_onboarding(
  p_role text,p_phone text,p_address text,p_business_name text default null,
  p_topup_amount numeric default null,p_payment_method text default null,
  p_reference_number text default null,p_proof_url text default null
) returns public.profiles language plpgsql security definer set search_path=public,auth as $$
declare v_profile public.profiles;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if p_role not in ('merchant','reseller') then raise exception 'INVALID_ROLE'; end if;
  if not exists(select 1 from auth.users where id=auth.uid() and email is not null and email_confirmed_at is not null) then raise exception 'VERIFIED_EMAIL_REQUIRED'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and onboarding_completed=false) then raise exception 'ONBOARDING_ALREADY_COMPLETED'; end if;
  if char_length(trim(coalesce(p_phone,'')))<7 then raise exception 'VALID_PHONE_REQUIRED'; end if;
  if char_length(trim(coalesce(p_address,'')))<12 then raise exception 'COMPLETE_ADDRESS_REQUIRED'; end if;
  if p_role='merchant' and char_length(trim(coalesce(p_business_name,'')))<2 then raise exception 'BUSINESS_NAME_REQUIRED'; end if;
  if p_role='reseller' and (coalesce(p_topup_amount,0)<=0 or p_payment_method not in ('gcash','maya','bank_transfer') or p_proof_url is null) then raise exception 'VALID_INITIAL_TOPUP_REQUIRED'; end if;
  perform set_config('app.google_onboarding','true',true);
  update public.profiles set role=p_role::public.user_role,phone=left(trim(p_phone),30),address=left(trim(p_address),500),account_status='pending',onboarding_completed=true,updated_at=now() where id=auth.uid() returning * into v_profile;
  if p_role='merchant' then
    insert into public.merchant_profiles(id,business_name,business_address,status) values(auth.uid(),left(trim(p_business_name),160),left(trim(p_address),500),'pending')
    on conflict(id) do update set business_name=excluded.business_name,business_address=excluded.business_address;
  end if;
  insert into public.wallets(owner_id,balance) values(auth.uid(),0) on conflict(owner_id) do nothing;
  if p_role='reseller' then
    insert into public.topup_requests(owner_id,amount,method,reference_number,proof_url,status)
    values(auth.uid(),p_topup_amount,p_payment_method::public.payment_method,left(trim(coalesce(p_reference_number,'')),120),p_proof_url,'pending');
  end if;
  return v_profile;
end; $$;
revoke all on function public.complete_account_onboarding(text,text,text,text,numeric,text,text,text) from public,anon;
grant execute on function public.complete_account_onboarding(text,text,text,text,numeric,text,text,text) to authenticated;
notify pgrst,'reload schema';
