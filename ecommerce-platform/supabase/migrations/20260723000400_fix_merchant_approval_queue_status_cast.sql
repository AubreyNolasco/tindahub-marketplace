-- get_merchant_approval_queue() declared merchant_status as `text` but
-- selected mp.status (enum public.merchant_status) without a cast, which
-- Postgres rejects with "structure of query does not match function result
-- type". This made the Admin Approval Center fail to load (HTTP 400) for
-- every request.
create or replace function public.get_merchant_approval_queue()
returns table(id uuid,full_name text,email text,business_name text,permit_status text,merchant_status text,subscription_request_id uuid,subscription_status text,plan_months integer,amount numeric,account_status text)
language plpgsql stable security definer set search_path=public as $$ begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  return query select p.id,p.full_name,p.email,mp.business_name,mp.business_permit_status,mp.status::text,sr.id,sr.status::text,sr.plan_months,sr.amount,p.account_status::text
  from public.profiles p join public.merchant_profiles mp on mp.id=p.id
  left join lateral(select * from public.subscription_requests r where r.owner_id=p.id order by r.created_at desc limit 1) sr on true
  where p.role='merchant' order by p.created_at desc; end
$$;
notify pgrst,'reload schema';
