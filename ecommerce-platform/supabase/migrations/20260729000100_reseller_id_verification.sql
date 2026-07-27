-- Reseller identity verification: a selfie + a valid government ID, reviewed
-- by Admin, gating reseller account approval alongside the existing initial
-- wallet top-up review. Only new signups are affected: existing resellers
-- are grandfathered as approved the moment this migration first runs.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'id_verification_status'
  ) then
    alter table public.profiles add column id_verification_selfie_url text;
    alter table public.profiles add column id_verification_document_url text;
    alter table public.profiles add column id_verification_status text not null default 'missing'
      check (id_verification_status in ('missing', 'pending', 'approved', 'rejected'));
    alter table public.profiles add column id_verification_notes text not null default '';
    alter table public.profiles add column id_verification_reviewed_at timestamptz;
    alter table public.profiles add column id_verification_reviewed_by uuid references public.profiles(id);

    -- Grandfather every reseller that already exists (approved or otherwise
    -- mid-flow) so this new requirement only applies to accounts created
    -- from this point forward.
    update public.profiles set id_verification_status = 'approved' where role = 'reseller';
  end if;
end $$;

-- Private bucket for both documents, folder-scoped per user like every
-- other verification bucket (business-permits, payment-proofs, ...).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reseller-id-verification', 'reseller-id-verification', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "reseller_id_verification_owner_upload" on storage.objects;
create policy "reseller_id_verification_owner_upload" on storage.objects for insert to authenticated
with check (bucket_id = 'reseller-id-verification' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "reseller_id_verification_owner_read" on storage.objects;
create policy "reseller_id_verification_owner_read" on storage.objects for select to authenticated
using (bucket_id = 'reseller-id-verification' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

drop policy if exists "reseller_id_verification_owner_update" on storage.objects;
create policy "reseller_id_verification_owner_update" on storage.objects for update to authenticated
using (bucket_id = 'reseller-id-verification' and (storage.foldername(name))[1] = auth.uid()::text);

-- Owners may submit/resubmit (missing/rejected -> pending) but can never
-- approve themselves or touch the review trail; only Admin can do that.
create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() and (
    new.id is distinct from old.id or new.role is distinct from old.role or
    new.account_status is distinct from old.account_status or new.created_at is distinct from old.created_at or
    new.id_verification_reviewed_at is distinct from old.id_verification_reviewed_at or
    new.id_verification_reviewed_by is distinct from old.id_verification_reviewed_by or
    new.id_verification_notes is distinct from old.id_verification_notes or
    (new.id_verification_status is distinct from old.id_verification_status and
     not (old.id_verification_status in ('missing', 'rejected') and new.id_verification_status = 'pending'))
  ) then raise exception 'PROTECTED_PROFILE_FIELDS'; end if;
  new.full_name := left(trim(new.full_name), 120);
  new.phone := left(new.phone, 30);
  return new;
end; $$;
drop trigger if exists trg_protect_profile_privileges on public.profiles;
create trigger trg_protect_profile_privileges before update on public.profiles
for each row execute function public.protect_profile_privileges();

-- A reseller only becomes active once BOTH the initial top-up and the ID
-- verification are approved. Shared by both trigger paths below.
create or replace function public.try_activate_reseller(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set account_status = 'approved', updated_at = now()
  where id = p_user_id and role = 'reseller' and account_status = 'pending'
    and id_verification_status = 'approved'
    and exists (select 1 from public.topup_requests where owner_id = p_user_id and status = 'approved');
end; $$;

create or replace function public.approve_reseller_from_initial_topup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status = 'pending' then
    perform public.try_activate_reseller(new.owner_id);
  elsif new.status = 'rejected' and old.status = 'pending' then
    update public.profiles set account_status = 'rejected', updated_at = now()
      where id = new.owner_id and role = 'reseller' and account_status = 'pending';
  end if;
  return new;
end; $$;
drop trigger if exists trg_approve_reseller_from_topup on public.topup_requests;
create trigger trg_approve_reseller_from_topup after update on public.topup_requests
for each row execute function public.approve_reseller_from_initial_topup();

create or replace function public.activate_reseller_from_id_verification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'reseller' and new.id_verification_status = 'approved'
     and old.id_verification_status is distinct from new.id_verification_status then
    perform public.try_activate_reseller(new.id);
  end if;
  return new;
end; $$;
drop trigger if exists trg_activate_reseller_from_id_verification on public.profiles;
create trigger trg_activate_reseller_from_id_verification after update on public.profiles
for each row execute function public.activate_reseller_from_id_verification();

-- Admin-only review queue and review action.
create or replace function public.get_admin_reseller_verifications()
returns table(
  id uuid, full_name text, phone text, email text, created_at timestamptz,
  id_verification_selfie_url text, id_verification_document_url text,
  id_verification_status text, id_verification_notes text,
  id_verification_reviewed_at timestamptz, account_status account_status
) language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  return query
    select p.id, p.full_name, p.phone, p.email, p.created_at,
      p.id_verification_selfie_url, p.id_verification_document_url,
      p.id_verification_status, p.id_verification_notes,
      p.id_verification_reviewed_at, p.account_status
    from public.profiles p
    where p.role = 'reseller'
    order by p.created_at desc;
end; $$;
revoke all on function public.get_admin_reseller_verifications() from public, anon;
grant execute on function public.get_admin_reseller_verifications() to authenticated;

create or replace function public.review_reseller_id_verification(p_user_id uuid, p_approved boolean, p_notes text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  update public.profiles set
    id_verification_status = case when p_approved then 'approved' else 'rejected' end,
    id_verification_notes = left(trim(coalesce(p_notes, '')), 500),
    id_verification_reviewed_at = now(),
    id_verification_reviewed_by = auth.uid()
  where id = p_user_id and role = 'reseller' and id_verification_status = 'pending';
end; $$;
revoke all on function public.review_reseller_id_verification(uuid, boolean, text) from public, anon;
grant execute on function public.review_reseller_id_verification(uuid, boolean, text) to authenticated;

-- Keep the weekly orphan-storage sweep aware of the new bucket/columns.
create or replace function public.list_storage_orphans(p_grace_period interval default '7 days')
returns table(bucket_id text, object_name text)
language sql
security definer
set search_path = public, storage
as $$
  with referenced as (
    select 'payment-proofs'::text as bucket, proof_url as path from public.payments where proof_url is not null
    union all select 'payment-proofs', proof_url from public.subscription_requests where proof_url is not null
    union all select 'payment-proofs', proof_url from public.topup_requests where proof_url is not null
    union all select 'withdrawal-proofs', transfer_proof_url from public.withdrawal_requests where transfer_proof_url is not null
    union all select 'delivery-proofs', dispatch_proof_url from public.orders where dispatch_proof_url is not null
    union all select 'order-case-evidence', evidence_url from public.order_cases where evidence_url is not null
    union all select 'business-permits', business_permit_url from public.merchant_profiles where business_permit_url is not null
    union all select 'reseller-id-verification', id_verification_selfie_url from public.profiles where id_verification_selfie_url is not null
    union all select 'reseller-id-verification', id_verification_document_url from public.profiles where id_verification_document_url is not null
    union all select 'product-images', regexp_replace(img,'^.*/storage/v1/object/public/product-images/','') from public.products, unnest(coalesce(images,'{}'::text[])) as img
    union all select 'reseller-storefronts', regexp_replace(avatar_url,'^.*/storage/v1/object/public/reseller-storefronts/','') from public.profiles where avatar_url like '%reseller-storefronts%'
    union all select 'reseller-storefronts', regexp_replace(cover_url,'^.*/storage/v1/object/public/reseller-storefronts/','') from public.profiles where cover_url like '%reseller-storefronts%'
  )
  select o.bucket_id, o.name
  from storage.objects o
  where o.created_at < now() - p_grace_period
    and not exists (select 1 from referenced r where r.bucket = o.bucket_id and r.path = o.name)
$$;
revoke all on function public.list_storage_orphans(interval) from public, anon, authenticated;
grant execute on function public.list_storage_orphans(interval) to service_role;

notify pgrst, 'reload schema';
