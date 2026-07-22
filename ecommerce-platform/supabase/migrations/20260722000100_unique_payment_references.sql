-- One payment reference may be used only once across top-ups and subscriptions.
-- Formatting differences such as spaces, dashes, and letter case are ignored.
create table if not exists public.payment_reference_registry (
  normalized_reference text primary key check (char_length(normalized_reference) between 6 and 120),
  original_reference text not null,
  source_type text not null check (source_type in ('topup', 'subscription')),
  source_id uuid not null,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.payment_reference_registry enable row level security;
revoke all on public.payment_reference_registry from public, anon, authenticated;

create or replace function public.normalize_payment_reference(p_reference text)
returns text language sql immutable parallel safe
as $$ select lower(regexp_replace(trim(coalesce(p_reference, '')), '[^a-zA-Z0-9]', '', 'g')) $$;

-- Preserve the first occurrence of every historical reference. Any existing
-- duplicate remains available for Admin reconciliation but can never be reused.
insert into public.payment_reference_registry (normalized_reference, original_reference, source_type, source_id, owner_id, created_at)
select normalized_reference, reference_number, source_type, source_id, owner_id, created_at
from (
  select public.normalize_payment_reference(reference_number) normalized_reference,
    reference_number, 'topup'::text source_type, id source_id, owner_id, created_at,
    row_number() over (partition by public.normalize_payment_reference(reference_number) order by created_at, id) occurrence
  from public.topup_requests where char_length(public.normalize_payment_reference(reference_number)) >= 6
  union all
  select public.normalize_payment_reference(reference_number), reference_number,
    'subscription'::text, id, owner_id, created_at,
    row_number() over (partition by public.normalize_payment_reference(reference_number) order by created_at, id)
  from public.subscription_requests where char_length(public.normalize_payment_reference(reference_number)) >= 6
) history
where occurrence = 1
on conflict (normalized_reference) do nothing;

create or replace function public.reserve_payment_reference()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_normalized text := public.normalize_payment_reference(new.reference_number);
  v_source text := case tg_table_name when 'topup_requests' then 'topup' else 'subscription' end;
begin
  if char_length(v_normalized) < 6 then raise exception 'INVALID_PAYMENT_REFERENCE'; end if;
  insert into public.payment_reference_registry (normalized_reference, original_reference, source_type, source_id, owner_id)
  values (v_normalized, trim(new.reference_number), v_source, new.id, new.owner_id);
  new.reference_number := left(trim(new.reference_number), 120);
  return new;
exception when unique_violation then
  raise exception 'DUPLICATE_PAYMENT_REFERENCE' using errcode = '23505';
end;
$$;

drop trigger if exists reserve_topup_payment_reference on public.topup_requests;
create trigger reserve_topup_payment_reference before insert on public.topup_requests
for each row execute function public.reserve_payment_reference();
drop trigger if exists reserve_subscription_payment_reference on public.subscription_requests;
create trigger reserve_subscription_payment_reference before insert on public.subscription_requests
for each row execute function public.reserve_payment_reference();

create or replace function public.is_payment_reference_available(p_reference text)
returns boolean language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null
    and char_length(public.normalize_payment_reference(p_reference)) >= 6
    and not exists (
      select 1 from public.payment_reference_registry
      where normalized_reference = public.normalize_payment_reference(p_reference)
    )
$$;
revoke all on function public.is_payment_reference_available(text) from public, anon;
grant execute on function public.is_payment_reference_available(text) to authenticated;

notify pgrst, 'reload schema';
