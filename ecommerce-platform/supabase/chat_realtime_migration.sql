-- =====================================================================
-- Enables live chat: adds chat_messages to the supabase_realtime
-- publication so postgres_changes subscriptions fire on new messages.
-- Safe to run once — idempotent.
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;
