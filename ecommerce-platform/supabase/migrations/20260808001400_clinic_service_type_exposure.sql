-- The new Marketplace nav icon row needs a real "Clinic" vs "Real
-- Estate" filter (not decorative icons pointing nowhere) --
-- merchant_profiles.service_type already distinguishes these
-- ('clinic', 'real_estate', 'both'), but
-- get_clinic_merchants_with_services() never exposed it to the
-- client, only used it server-side to decide which merchants to
-- include at all. Additive: adds one column to the result set,
-- doesn't change which rows are returned or any existing caller's
-- behavior.
-- CREATE OR REPLACE can't change an existing function's return
-- signature (adding a column to RETURNS TABLE counts as a change) --
-- Postgres requires a DROP first.
drop function if exists public.get_clinic_merchants_with_services();

create function public.get_clinic_merchants_with_services()
returns table(merchant_id uuid, business_name text, business_description text, business_address text, avatar_url text, service_type text, services json)
language sql
security definer
set search_path to 'public'
as $function$
  select
    mp.id as merchant_id,
    mp.business_name,
    mp.business_description,
    mp.business_address,
    p.avatar_url,
    mp.service_type,
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
$function$;

-- DROP removes all prior grants -- restore them explicitly rather
-- than relying on default PUBLIC execute (confirmed the prior grants
-- via information_schema.routine_privileges before writing this).
grant execute on function public.get_clinic_merchants_with_services() to authenticated, anon;
