-- Mandatory merchant business-permit verification.
alter table public.merchant_profiles add column if not exists business_permit_url text;
alter table public.merchant_profiles add column if not exists business_permit_status text not null default 'missing'
  check (business_permit_status in ('missing', 'pending', 'approved', 'rejected'));
alter table public.merchant_profiles add column if not exists business_permit_notes text not null default '';
alter table public.merchant_profiles add column if not exists business_permit_reviewed_at timestamptz;
alter table public.merchant_profiles add column if not exists business_permit_reviewed_by uuid references public.profiles(id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('business-permits', 'business-permits', false, 8388608, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "business_permit_owner_upload" on storage.objects;
create policy "business_permit_owner_upload" on storage.objects for insert to authenticated
with check (bucket_id = 'business-permits' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "business_permit_owner_read" on storage.objects;
create policy "business_permit_owner_read" on storage.objects for select to authenticated
using (bucket_id = 'business-permits' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "business_permit_owner_update" on storage.objects;
create policy "business_permit_owner_update" on storage.objects for update to authenticated
using (bucket_id = 'business-permits' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.enforce_merchant_permit_approval()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'approved' and new.business_permit_status <> 'approved' then
    raise exception 'BUSINESS_PERMIT_NOT_APPROVED';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_enforce_merchant_permit_approval on public.merchant_profiles;
create trigger trg_enforce_merchant_permit_approval before insert or update on public.merchant_profiles
for each row execute function public.enforce_merchant_permit_approval();

-- Enforce the rule for existing merchant accounts without deleting any data.
update public.merchant_profiles set status = 'pending'
where status = 'approved' and business_permit_status <> 'approved';

create or replace function public.block_unverified_merchant_purchase()
returns trigger language plpgsql set search_path = public as $$
begin
  if exists (select 1 from public.profiles p where p.id = new.reseller_id and p.role = 'merchant')
     and not exists (select 1 from public.merchant_profiles mp where mp.id = new.reseller_id and mp.status = 'approved' and mp.business_permit_status = 'approved') then
    raise exception 'MERCHANT_BUSINESS_PERMIT_REQUIRED';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_block_unverified_merchant_purchase on public.orders;
create trigger trg_block_unverified_merchant_purchase before insert on public.orders
for each row execute function public.block_unverified_merchant_purchase();
