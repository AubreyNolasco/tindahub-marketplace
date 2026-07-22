-- JOM HUB privacy-conscious activity audit history.
create table if not exists public.activity_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  old_status text,
  new_status text,
  created_at timestamptz not null default now()
);
create index if not exists activity_audit_logs_created_idx on public.activity_audit_logs(created_at desc);
create index if not exists activity_audit_logs_entity_idx on public.activity_audit_logs(entity_type,entity_id);
alter table public.activity_audit_logs enable row level security;
drop policy if exists activity_audit_admin_read on public.activity_audit_logs;
create policy activity_audit_admin_read on public.activity_audit_logs for select to authenticated using(public.is_admin());
revoke all on public.activity_audit_logs from anon;
grant select on public.activity_audit_logs to authenticated;

create or replace function public.capture_activity_audit()
returns trigger language plpgsql security definer set search_path=public as $$
declare old_value jsonb; new_value jsonb; record_id text;
begin
  old_value := case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
  new_value := case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
  record_id := coalesce(new_value->>'id',old_value->>'id');
  insert into public.activity_audit_logs(actor_id,action,entity_type,entity_id,old_status,new_status)
  values(auth.uid(),lower(tg_op),tg_table_name,record_id,old_value->>'status',new_value->>'status');
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;

do $$ declare table_name text;
begin
  foreach table_name in array array['orders','topup_requests','withdrawal_requests','subscription_requests','registration_appointments','products','merchant_profiles','order_cases'] loop
    execute format('drop trigger if exists capture_activity_audit_trigger on public.%I',table_name);
    execute format('create trigger capture_activity_audit_trigger after insert or update or delete on public.%I for each row execute function public.capture_activity_audit()',table_name);
  end loop;
end $$;
