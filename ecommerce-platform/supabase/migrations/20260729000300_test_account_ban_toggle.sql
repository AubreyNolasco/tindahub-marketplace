-- Real enable/disable control for the two named test accounts
-- (reseller@gmail.com, merchant@gmail.com), replacing the cosmetic toggle
-- removed in 20260729000200_remove_dead_test_accounts_toggle.sql. This one
-- actually flips auth.users.banned_until, admin-gated and hardcoded to only
-- ever target these two emails -- it is deliberately not a general-purpose
-- user ban tool. Enabling only restores sign-in ability; it does not restore
-- the auto-approval / free-wallet backdoor removed by
-- 20260723002800_remove_test_account_privilege_backdoor.sql, which stays gone.

create or replace function public.get_test_accounts_ban_status()
returns table(email text, banned boolean)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  return query
    select lower(u.email), (u.banned_until is not null and u.banned_until > now())
    from auth.users u
    where lower(u.email) in ('reseller@gmail.com', 'merchant@gmail.com');
end;
$$;

revoke all on function public.get_test_accounts_ban_status() from public, anon;
grant execute on function public.get_test_accounts_ban_status() to authenticated;

create or replace function public.set_test_account_banned(p_email text, p_banned boolean)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if v_email not in ('reseller@gmail.com', 'merchant@gmail.com') then
    raise exception 'INVALID_TEST_ACCOUNT';
  end if;

  select id into v_id from auth.users where lower(email) = v_email;
  if v_id is null then raise exception 'TEST_ACCOUNT_NOT_FOUND'; end if;

  update auth.users
  set banned_until = case when p_banned then 'infinity'::timestamptz else null end,
      updated_at = now()
  where id = v_id;

  if p_banned then
    delete from auth.sessions where user_id = v_id;
  end if;
end;
$$;

revoke all on function public.set_test_account_banned(text, boolean) from public, anon;
grant execute on function public.set_test_account_banned(text, boolean) to authenticated;

notify pgrst, 'reload schema';
