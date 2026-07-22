-- Keep Merchant/Reseller conversations inside JOM HUB.
create or replace function public.chat_contains_contact_info(p_message text)
returns boolean language plpgsql immutable set search_path = public as $$
declare v text := lower(coalesce(p_message, ''));
begin
  return
    -- Email addresses and deliberately spaced email formats.
    v ~ '[a-z0-9._%+-]+[[:space:]]*(@|\[at\]|\(at\)| at )[[:space:]]*[a-z0-9.-]+[[:space:]]*(\.|\[dot\]|\(dot\)| dot )[[:space:]]*[a-z]{2,}'
    -- Philippine and international-looking phone numbers with separators.
    or v ~ '(^|[^0-9])(\+?[[:space:]-]*63|0)[[:space:]().-]*9[0-9[:space:]().-]{8,12}([^0-9]|$)'
    or v ~ '(^|[^0-9])[0-9]{3,4}[[:space:].-][0-9]{3,4}[[:space:].-][0-9]{3,4}([^0-9]|$)'
    or v ~ '(^|[^0-9])[0-9]{8,15}([^0-9]|$)'
    -- URLs, domains, and social handles.
    or v ~ '(https?://|www\.|[a-z0-9-]+\.(com|net|org|ph|io|me)(/|[[:space:]]|$))'
    or v ~ '(^|[[:space:]])@[a-z0-9._-]{3,}'
    -- Explicit attempts to move to another messaging platform.
    or v ~ '(facebook|fb|messenger|instagram|insta|telegram|whatsapp|viber|wechat|signal|discord|tiktok)[[:space:]:-]*(id|user(name)?|account|handle|number|no\.)'
    or v ~ '(text|call|message|contact|dm|pm)[[:space:]]+(me|us)[[:space:]]+(at|on|via)';
end; $$;

create or replace function public.block_chat_contact_info()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.message := trim(new.message);
  if public.chat_contains_contact_info(new.message) then
    raise exception 'CONTACT_INFO_NOT_ALLOWED_IN_CHAT';
  end if;
  return new;
end; $$;

drop trigger if exists trg_block_chat_contact_info on public.chat_messages;
create trigger trg_block_chat_contact_info before insert or update of message on public.chat_messages
for each row execute function public.block_chat_contact_info();

revoke all on function public.chat_contains_contact_info(text) from public, anon;
grant execute on function public.chat_contains_contact_info(text) to authenticated;
