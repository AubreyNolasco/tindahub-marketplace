-- activate_existing_invited_staff() (20260805000100_fix_staff_access.sql)
-- is meant to skip auto-converting an existing account to staff when it
-- already has a conflicting role -- its own comment says so -- but the
-- check only lists 'merchant', not 'reseller'. An admin inviting the
-- email address of an existing, approved reseller (with live orders,
-- wallet, customers) as staff would silently flip that account's role to
-- 'staff', with no equivalent guard the merchant case already has.
-- activate_invited_staff() (the brand-new-signup counterpart) has no such
-- gap since there's no prior role to conflict with on a fresh insert.

create or replace function public.activate_existing_invited_staff()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  v_user_id uuid;
begin
  if new.status <> 'pending' then return new; end if;
  select id into v_user_id from auth.users where lower(email) = new.email limit 1;
  if v_user_id is null then return new; end if;

  -- If the invited user already answered a role prompt, do not silently
  -- flip them to staff; only activate when they have no conflicting role.
  if exists (select 1 from public.profiles where id = v_user_id and role in ('merchant', 'reseller')) then
    return new;
  end if;

  perform set_config('app.staff_activation', 'true', true);

  update public.profiles set role='staff', full_name=new.full_name,
    account_status='approved', onboarding_completed=true where id=v_user_id;

  insert into public.staff_access(user_id,permissions,active,created_by)
  values(v_user_id,new.permissions,true,new.invited_by)
  on conflict(user_id) do update set permissions=excluded.permissions,active=true,updated_at=now();

  update public.staff_invitations set status='accepted',accepted_at=now() where id=new.id;
  return new;
end; $$;

notify pgrst, 'reload schema';
