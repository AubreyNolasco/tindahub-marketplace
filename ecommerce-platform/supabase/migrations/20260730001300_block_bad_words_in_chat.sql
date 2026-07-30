-- Block common English/Tagalog profanity in chat messages, applied to both
-- the merchant<->reseller marketplace chat and the Admin support chat.

create or replace function public.contains_bad_words(p_text text)
returns boolean
language sql
immutable
as $function$
  select p_text ~* '\m(fuck\w*|shit\w*|bitch\w*|assh[o0]le\w*|bastard\w*|d[i1]ck\w*|pussy\w*|cunt\w*|whore\w*|slut\w*|motherfuck\w*|n[i1]gg[ae3]r?\w*|faggot\w*|cock\w*|tangina\w*|putangina\w*|puta|gago\w*|gaga\w*|ulol\w*|tarantado\w*|kingina\w*|punyeta\w*|hinayupak\w*)\M'
    or p_text ~* 'putang\s*ina'
$function$;

create or replace function public.block_bad_words_trigger()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if public.contains_bad_words(new.message) then
    raise exception 'BAD_WORDS_NOT_ALLOWED_IN_CHAT';
  end if;
  return new;
end; $function$;

drop trigger if exists trg_block_chat_bad_words on public.chat_messages;
create trigger trg_block_chat_bad_words
before insert on public.chat_messages
for each row execute function public.block_bad_words_trigger();

drop trigger if exists trg_block_support_bad_words on public.support_messages;
create trigger trg_block_support_bad_words
before insert on public.support_messages
for each row execute function public.block_bad_words_trigger();
