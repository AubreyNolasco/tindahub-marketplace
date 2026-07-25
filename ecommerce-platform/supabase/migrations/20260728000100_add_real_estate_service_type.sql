-- =====================================================================
-- TindaHub Marketplace — Add Real Estate as a Service Type
-- Same referral workflow as clinic (reseller refers, merchant pays fee)
-- =====================================================================

-- 1. Update merchant_profiles check constraint to include 'real_estate'
alter table public.merchant_profiles
  drop constraint if exists merchant_profiles_service_type_check;

alter table public.merchant_profiles
  add constraint merchant_profiles_service_type_check
  check (service_type in ('product', 'clinic', 'real_estate', 'both'));

-- 2. Update the RPC that fetches clinic/real_estate merchants to include both
create or replace function public.get_clinic_merchants_with_services()
returns table (
  merchant_id uuid,
  business_name text,
  business_description text,
  business_address text,
  avatar_url text,
  services json
)
language sql
security definer
set search_path = public
as $$
  select
    mp.id as merchant_id,
    mp.business_name,
    mp.business_description,
    mp.business_address,
    p.avatar_url,
    coalesce(
      (select json_agg(
        json_build_object(
          'id', cs.id,
          'name', cs.name,
          'description', cs.description,
          'service_fee', cs.service_fee,
          'referral_fee', cs.referral_fee,
          'estimated_duration_minutes', cs.estimated_duration_minutes
        )
        order by cs.name
       )
       from public.clinic_services cs
       where cs.merchant_id = mp.id and cs.is_active = true
      ),
      '[]'::json
    ) as services
  from public.merchant_profiles mp
  join public.profiles p on p.id = mp.id
  where mp.service_type in ('clinic', 'real_estate', 'both')
    and mp.status = 'approved'
  order by mp.business_name;
$$;

grant execute on function public.get_clinic_merchants_with_services() to authenticated;

-- 3. Create a separate RPC for real estate only (optional, for filtered browsing)
create or replace function public.get_service_merchants_by_type(p_service_type text)
returns table (
  merchant_id uuid,
  business_name text,
  business_description text,
  business_address text,
  avatar_url text,
  services json
)
language sql
security definer
set search_path = public
as $$
  select
    mp.id as merchant_id,
    mp.business_name,
    mp.business_description,
    mp.business_address,
    p.avatar_url,
    coalesce(
      (select json_agg(
        json_build_object(
          'id', cs.id,
          'name', cs.name,
          'description', cs.description,
          'service_fee', cs.service_fee,
          'referral_fee', cs.referral_fee,
          'estimated_duration_minutes', cs.estimated_duration_minutes
        )
        order by cs.name
       )
       from public.clinic_services cs
       where cs.merchant_id = mp.id and cs.is_active = true
      ),
      '[]'::json
    ) as services
  from public.merchant_profiles mp
  join public.profiles p on p.id = mp.id
  where mp.service_type = p_service_type
    and mp.status = 'approved'
  order by mp.business_name;
$$;

grant execute on function public.get_service_merchants_by_type(text) to authenticated;

notify pgrst, 'reload schema';
