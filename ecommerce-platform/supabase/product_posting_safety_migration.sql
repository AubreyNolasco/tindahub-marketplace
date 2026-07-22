create or replace function public.enforce_product_posting_safety()
returns trigger language plpgsql set search_path = public as $$
declare
  listing_text text := lower(concat_ws(' ', new.name, new.description, new.product_type, new.sku));
  blocked_phrase text;
  blocked_phrases constant text[] := array[
    'illegal drugs','shabu','methamphetamine','cocaine','heroin','ecstasy pills','drug paraphernalia',
    'unlicensed firearm','ghost gun','live ammunition','improvised explosive','pipe bomb',
    'counterfeit','fake branded','class a replica','stolen goods','pirated software',
    'child pornography','sexual services','online sabong','illegal gambling','fake id','fake passport','fake diploma',
    'bank account for sale','e-wallet account for sale','sim account for sale','stolen account','login credentials',
    'customer database for sale','credit card dump','unregistered medicine','unregistered supplement',
    'unregistered cosmetic','unregistered medical device','no fda approval','expired product','recalled product'
  ];
begin
  foreach blocked_phrase in array blocked_phrases loop
    if listing_text like '%' || blocked_phrase || '%' then
      raise exception using errcode = '23514', message = 'This listing contains prohibited or unsafe product content: ' || blocked_phrase;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists products_posting_safety_guard on public.products;
create trigger products_posting_safety_guard
before insert or update of name, description, product_type, sku on public.products
for each row execute function public.enforce_product_posting_safety();

comment on function public.enforce_product_posting_safety() is
'Blocks explicit high-risk listing phrases. This assists but does not replace manual moderation or regulatory verification.';
