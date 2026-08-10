-- Repair database errors surfaced by `supabase db lint --linked` during the
-- full-system audit.

-- The voucher-enabled five-argument function supersedes this overload. Its
-- presence makes every four-argument PL/pgSQL call ambiguous because the new
-- function's fifth argument has a default.
drop function if exists public.place_order(uuid, text, jsonb, numeric);

create or replace function public.expire_business_permits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.merchant_profiles
  set business_permit_status = 'rejected',
      business_permit_notes = 'Business permit expired on ' || to_char(business_permit_expires_at, 'Mon DD, YYYY') || '. Please upload a renewed document.'
  where business_permit_status = 'approved'
    and business_permit_expires_at is not null
    and business_permit_expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.expire_business_permits() from public, anon, authenticated;

create or replace function public.admin_grant_subscription(p_owner_id uuid, p_status text, p_expires_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_role text;
begin
  if not public.has_admin_permission('subscriptions') then raise exception 'ADMIN_REQUIRED'; end if;
  if p_status not in ('active', 'expired', 'cancelled') then raise exception 'INVALID_SUBSCRIPTION_STATUS'; end if;

  select role into v_role from public.profiles where id = p_owner_id;
  if v_role is null then raise exception 'PROFILE_NOT_FOUND'; end if;

  insert into public.subscriptions(owner_id, status, is_free, started_at, expires_at, updated_at)
  values (p_owner_id, p_status::public.subscription_status, false, now(), p_expires_at, now())
  on conflict (owner_id) do update set
    status = excluded.status, is_free = false, expires_at = excluded.expires_at, updated_at = now();

  if v_role = 'merchant' then
    update public.merchant_profiles set
      subscription_active = (p_status = 'active'),
      subscription_expires_at = p_expires_at
    where id = p_owner_id;
  end if;
end;
$$;

revoke all on function public.admin_grant_subscription(uuid, text, timestamptz) from public, anon;
grant execute on function public.admin_grant_subscription(uuid, text, timestamptz) to authenticated;

notify pgrst, 'reload schema';
