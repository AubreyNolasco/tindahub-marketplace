-- Record one successful login event per Supabase auth session.
-- loadProfile may run more than once as auth state is restored or refreshed, so
-- the database session id is the authoritative idempotency key.
alter table public.login_history
  add column if not exists auth_session_id text;

create unique index if not exists idx_login_history_auth_session
  on public.login_history(auth_session_id)
  where auth_session_id is not null;

create or replace function public.record_login_event(p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_headers jsonb;
  v_ip text;
  v_session_id text := nullif(auth.jwt()->>'session_id', '');
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;

  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
    v_ip := coalesce(
      v_headers->>'cf-connecting-ip',
      split_part(v_headers->>'x-forwarded-for', ',', 1)
    );
  exception when others then
    v_ip := null;
  end;

  insert into public.login_history (
    user_id, ip_address, user_agent, auth_session_id
  ) values (
    auth.uid(), left(trim(v_ip), 64), left(p_user_agent, 500), v_session_id
  )
  on conflict (auth_session_id) where auth_session_id is not null do nothing;
end;
$$;

revoke all on function public.record_login_event(text) from public, anon;
grant execute on function public.record_login_event(text) to authenticated;

notify pgrst, 'reload schema';
