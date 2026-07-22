-- Admin-safe merchant review data. This avoids granting table-wide SELECT on
-- merchant_profiles, which would expose private pickup addresses to users who
-- may read approved merchant rows.
create or replace function public.get_admin_merchant_profiles()
returns table (
  id uuid,
  business_name text,
  status public.merchant_status,
  created_at timestamptz,
  business_permit_url text,
  business_permit_status text,
  business_permit_notes text,
  business_permit_reviewed_at timestamptz,
  business_permit_reviewed_by uuid,
  profile_full_name text,
  profile_phone text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  return query
  select
    mp.id,
    mp.business_name,
    mp.status,
    mp.created_at,
    mp.business_permit_url,
    mp.business_permit_status,
    mp.business_permit_notes,
    mp.business_permit_reviewed_at,
    mp.business_permit_reviewed_by,
    p.full_name,
    p.phone
  from public.merchant_profiles mp
  join public.profiles p on p.id = mp.id
  order by mp.created_at desc;
end;
$$;

revoke all on function public.get_admin_merchant_profiles() from public, anon;
grant execute on function public.get_admin_merchant_profiles() to authenticated;

