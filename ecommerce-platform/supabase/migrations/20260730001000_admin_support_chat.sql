-- New Admin <-> Merchant/Reseller support chat channel, separate from the
-- existing merchant<->reseller marketplace chat (chat_messages), which
-- deliberately blocks contact info and which Admin can only monitor
-- read-only. Here, sharing name/contact info with Admin is the point.

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_role public.user_role not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_support_messages_thread on public.support_messages(user_id, created_at);

alter table public.support_messages enable row level security;

-- sender_role is stamped server-side from the caller's real role, never
-- trusted from the client, so notification queries can filter by it safely.
create or replace function public.stamp_support_sender_role()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  new.sender_role := public.current_user_role();
  return new;
end; $function$;

drop trigger if exists trg_stamp_support_sender_role on public.support_messages;
create trigger trg_stamp_support_sender_role
before insert on public.support_messages
for each row execute function public.stamp_support_sender_role();

create or replace function public.protect_support_update()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if public.is_admin() then return new; end if;
  if new.id is distinct from old.id or new.sender_id is distinct from old.sender_id or
     new.sender_role is distinct from old.sender_role or new.user_id is distinct from old.user_id or
     new.message is distinct from old.message or new.created_at is distinct from old.created_at or
     new.is_read is not true then
    raise exception 'INVALID_SUPPORT_UPDATE';
  end if;
  return new;
end; $function$;

drop trigger if exists trg_protect_support_update on public.support_messages;
create trigger trg_protect_support_update
before update on public.support_messages
for each row execute function public.protect_support_update();

drop policy if exists support_participant_insert on public.support_messages;
create policy support_participant_insert on public.support_messages
for insert with check (
  sender_id = auth.uid()
  and (user_id = auth.uid() or public.has_admin_permission('support'))
  and char_length(message) >= 1 and char_length(message) <= 2000
);

drop policy if exists support_participant_select on public.support_messages;
create policy support_participant_select on public.support_messages
for select using (
  user_id = auth.uid() or public.has_admin_permission('support')
);

drop policy if exists support_participant_update on public.support_messages;
create policy support_participant_update on public.support_messages
for update using (
  user_id = auth.uid() or public.has_admin_permission('support')
);

-- Required for the realtime postgres_changes subscriptions used by
-- SupportChatThread.jsx / notification listeners (mirrors chat_messages).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'support_messages'
  ) then
    alter publication supabase_realtime add table public.support_messages;
  end if;
end $$;
