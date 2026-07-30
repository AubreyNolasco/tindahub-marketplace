-- Emoji reactions on individual support_messages rows.

create table if not exists public.support_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.support_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create index if not exists idx_support_reactions_message on public.support_message_reactions(message_id);

alter table public.support_message_reactions enable row level security;

drop policy if exists support_reactions_select on public.support_message_reactions;
create policy support_reactions_select on public.support_message_reactions
for select using (
  exists (
    select 1 from public.support_messages sm
    where sm.id = message_id and (sm.user_id = auth.uid() or public.has_admin_permission('support'))
  )
);

drop policy if exists support_reactions_insert on public.support_message_reactions;
create policy support_reactions_insert on public.support_message_reactions
for insert with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.support_messages sm
    where sm.id = message_id and (sm.user_id = auth.uid() or public.has_admin_permission('support'))
  )
);

drop policy if exists support_reactions_delete on public.support_message_reactions;
create policy support_reactions_delete on public.support_message_reactions
for delete using (user_id = auth.uid());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'support_message_reactions'
  ) then
    alter publication supabase_realtime add table public.support_message_reactions;
  end if;
end $$;
