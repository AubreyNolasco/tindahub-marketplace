-- Evidence storage and safe Admin invitation follow-up.
alter table public.withdrawal_requests add column if not exists transfer_proof_url text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('delivery-proofs','delivery-proofs',false,8388608,array['image/jpeg','image/png','image/webp','application/pdf']),
('withdrawal-proofs','withdrawal-proofs',false,8388608,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists delivery_proof_merchant_upload on storage.objects;
create policy delivery_proof_merchant_upload on storage.objects for insert to authenticated with check(bucket_id='delivery-proofs' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists delivery_proof_participant_read on storage.objects;
create policy delivery_proof_participant_read on storage.objects for select to authenticated using(bucket_id='delivery-proofs' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin() or exists(select 1 from public.orders o where o.id::text=(storage.foldername(name))[2] and o.reseller_id=auth.uid())));
drop policy if exists withdrawal_proof_admin_upload on storage.objects;
create policy withdrawal_proof_admin_upload on storage.objects for insert to authenticated with check(bucket_id='withdrawal-proofs' and public.is_admin());
drop policy if exists withdrawal_proof_owner_read on storage.objects;
create policy withdrawal_proof_owner_read on storage.objects for select to authenticated using(bucket_id='withdrawal-proofs' and (public.is_admin() or exists(select 1 from public.withdrawal_requests w where w.id::text=(storage.foldername(name))[2] and w.owner_id=auth.uid())));

create or replace function public.mark_withdrawal_sent_with_proof(p_request_id uuid,p_transfer_reference text,p_proof_url text)
returns public.withdrawal_requests language plpgsql security definer set search_path=public as $$
declare result public.withdrawal_requests;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if char_length(trim(coalesce(p_transfer_reference,'')))<4 or nullif(trim(p_proof_url),'') is null then raise exception 'TRANSFER_REFERENCE_AND_PROOF_REQUIRED'; end if;
  update public.withdrawal_requests set sent_at=now(),sent_by=auth.uid(),transfer_reference=left(trim(p_transfer_reference),120),transfer_proof_url=p_proof_url
  where id=p_request_id and status='approved' and sent_at is null returning * into result;
  if result.id is null then raise exception 'WITHDRAWAL_NOT_APPROVED_OR_ALREADY_SENT'; end if; return result;
end $$;
grant execute on function public.mark_withdrawal_sent_with_proof(uuid,text,text) to authenticated;

create or replace function public.activate_account_invitation()
returns trigger language plpgsql security definer set search_path=public,auth as $$
declare v_inv public.account_invitations; v_email text;
begin
  select lower(email) into v_email from auth.users where id=new.id; select * into v_inv from public.account_invitations where email=v_email and status='pending' limit 1;
  if v_inv.id is null then return new; end if;
  update public.profiles set full_name=v_inv.full_name,phone=v_inv.phone,role=v_inv.role,account_status=case when v_inv.role='merchant' then 'pending' else 'approved' end,onboarding_completed=true where id=new.id;
  if v_inv.role='merchant' then insert into public.merchant_profiles(id,business_name,status,subscription_active) values(new.id,coalesce(nullif(trim(v_inv.business_name),''),v_inv.full_name),'pending',false) on conflict(id) do update set business_name=excluded.business_name,status='pending',subscription_active=false; end if;
  insert into public.wallets(owner_id,balance) values(new.id,0) on conflict(owner_id) do nothing;
  if v_inv.role='reseller' then insert into public.subscriptions(owner_id,status,is_free,started_at,expires_at) values(new.id,'active',true,now(),now()+interval '1 year') on conflict(owner_id) do nothing; end if;
  update public.account_invitations set status='accepted',accepted_at=now() where id=v_inv.id; return new;
end $$;

create or replace function public.activate_existing_account_invitation()
returns trigger language plpgsql security definer set search_path=public,auth as $$
declare v_user_id uuid;
begin
  if new.status<>'pending' then return new; end if; select id into v_user_id from auth.users where lower(email)=new.email limit 1; if v_user_id is null then return new; end if;
  update public.profiles set full_name=new.full_name,phone=new.phone,role=new.role,account_status=case when new.role='merchant' then 'pending' else 'approved' end,onboarding_completed=true where id=v_user_id;
  if new.role='merchant' then insert into public.merchant_profiles(id,business_name,status,subscription_active) values(v_user_id,coalesce(nullif(trim(new.business_name),''),new.full_name),'pending',false) on conflict(id) do update set business_name=excluded.business_name,status='pending',subscription_active=false; end if;
  insert into public.wallets(owner_id,balance) values(v_user_id,0) on conflict(owner_id) do nothing;
  if new.role='reseller' then insert into public.subscriptions(owner_id,status,is_free,started_at,expires_at) values(v_user_id,'active',true,now(),now()+interval '1 year') on conflict(owner_id) do nothing; end if;
  update public.account_invitations set status='accepted',accepted_at=now() where id=new.id; return new;
end $$;
notify pgrst,'reload schema';
