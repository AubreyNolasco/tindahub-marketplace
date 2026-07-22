-- Admin-visible successful login audit trail.
create table if not exists public.login_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  ip_address text,
  user_agent text,
  logged_in_at timestamptz not null default now()
);

create index if not exists idx_login_history_user on public.login_history(user_id);
create index if not exists idx_login_history_date on public.login_history(logged_in_at desc);
alter table public.login_history enable row level security;

drop policy if exists "login_history_admin_select" on public.login_history;
create policy "login_history_admin_select" on public.login_history
  for select to authenticated using (public.is_admin());

-- Inserts are only allowed through this function. user_id is always auth.uid().
create or replace function public.record_login_event(p_user_agent text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_headers jsonb;
  v_ip text;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
    v_ip := coalesce(v_headers->>'cf-connecting-ip', split_part(v_headers->>'x-forwarded-for', ',', 1));
  exception when others then v_ip := null;
  end;
  insert into public.login_history (user_id, ip_address, user_agent)
  values (auth.uid(), left(trim(v_ip), 64), left(p_user_agent, 500));
end; $$;

revoke all on function public.record_login_event(text) from public, anon;
grant execute on function public.record_login_event(text) to authenticated;

-- Keep the audit table bounded. Admin may call this periodically if desired.
create or replace function public.purge_old_login_history()
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  delete from public.login_history where logged_in_at < now() - interval '2 years';
  get diagnostics v_count = row_count;
  return v_count;
end; $$;
revoke all on function public.purge_old_login_history() from public, anon;
grant execute on function public.purge_old_login_history() to authenticated;
