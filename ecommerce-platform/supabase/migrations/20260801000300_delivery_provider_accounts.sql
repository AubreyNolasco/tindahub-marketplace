-- =====================================================================
-- Delivery Provider Engine — Phase 2
--
-- Formalizes ownership across all three tiers (Merchant / Reseller /
-- Platform) that share the same shape, instead of the reseller-only
-- lalamove_settings table. Existing reseller Lalamove accounts are
-- backfilled in; lalamove_settings itself is left untouched (frozen,
-- not dropped) as a historical record — new writes go through this
-- table exclusively from here on.
--
-- Credentials for a two-secret provider like Lalamove (api key + api
-- secret) don't fit a single `credentials_id` column, so vault secret
-- pointers live inside `metadata` alongside non-secret config (market)
-- — the secrets themselves are never stored in this table, same as
-- lalamove_settings before it.
-- =====================================================================

do $$ begin
  create type public.delivery_owner_type as enum ('merchant', 'reseller', 'platform');
exception when duplicate_object then null; end $$;

create table if not exists public.delivery_provider_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_type public.delivery_owner_type not null,
  owner_id uuid references public.profiles(id) on delete cascade,
  provider_code text not null references public.delivery_providers(code),
  is_enabled boolean not null default false,
  priority int not null default 100,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_provider_accounts_owner_id_required_unless_platform
    check (owner_type = 'platform' or owner_id is not null)
);

create unique index if not exists delivery_provider_accounts_owner_unique
  on public.delivery_provider_accounts(owner_type, owner_id, provider_code) where owner_id is not null;
create unique index if not exists delivery_provider_accounts_platform_unique
  on public.delivery_provider_accounts(owner_type, provider_code) where owner_type = 'platform';

alter table public.delivery_provider_accounts enable row level security;

drop policy if exists "delivery_provider_accounts_owner_read" on public.delivery_provider_accounts;
create policy "delivery_provider_accounts_owner_read" on public.delivery_provider_accounts
  for select to authenticated using (owner_id = auth.uid() or public.is_admin());

-- No insert/update/delete grants on the table itself — all writes go
-- through save_delivery_provider_account() below, same convention as
-- lalamove_settings.
grant select on public.delivery_provider_accounts to authenticated;

-- ---------------------------------------------------------------------
-- Backfill existing reseller Lalamove accounts
-- ---------------------------------------------------------------------
insert into public.delivery_provider_accounts (owner_type, owner_id, provider_code, is_enabled, priority, metadata)
select
  'reseller', ls.owner_id, 'lalamove', ls.is_enabled, 100,
  jsonb_build_object(
    'api_key_secret_id', ls.api_key_secret_id,
    'api_secret_secret_id', ls.api_secret_secret_id,
    'market', ls.market
  )
from public.lalamove_settings ls
where ls.owner_id is not null
on conflict do nothing;

-- ---------------------------------------------------------------------
-- save_delivery_provider_account — one RPC for all three owner tiers.
-- Mirrors save_lalamove_settings but resolves owner_id from the caller's
-- role (or requires admin for the platform tier) instead of assuming
-- reseller.
-- ---------------------------------------------------------------------
create or replace function public.save_delivery_provider_account(
  p_owner_type text,
  p_provider_code text,
  p_api_key text default null,
  p_api_secret text default null,
  p_market text default 'PH_MNL',
  p_is_enabled boolean default false,
  p_priority int default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_uid uuid := auth.uid();
  v_owner_type public.delivery_owner_type;
  v_owner_id uuid;
  v_role public.user_role;
  v_existing public.delivery_provider_accounts;
  v_key_id uuid;
  v_secret_id uuid;
  v_metadata jsonb;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  v_owner_type := p_owner_type::public.delivery_owner_type;

  if v_owner_type = 'platform' then
    if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
    v_owner_id := null;
  else
    select role into v_role from public.profiles where id = v_uid;
    if v_role is null or v_role::text <> p_owner_type then raise exception 'FORBIDDEN'; end if;
    v_owner_id := v_uid;
  end if;

  select * into v_existing from public.delivery_provider_accounts
    where owner_type = v_owner_type and provider_code = p_provider_code
      and (owner_id = v_owner_id or (owner_id is null and v_owner_id is null));

  v_key_id := nullif(v_existing.metadata->>'api_key_secret_id', '')::uuid;
  v_secret_id := nullif(v_existing.metadata->>'api_secret_secret_id', '')::uuid;

  if p_api_key is not null and length(trim(p_api_key)) > 0 then
    if v_key_id is null then
      v_key_id := vault.create_secret(p_api_key, p_provider_code || '_api_key_' || coalesce(v_owner_id::text, 'platform') || '_' || gen_random_uuid()::text);
    else
      perform vault.update_secret(v_key_id, p_api_key);
    end if;
  end if;

  if p_api_secret is not null and length(trim(p_api_secret)) > 0 then
    if v_secret_id is null then
      v_secret_id := vault.create_secret(p_api_secret, p_provider_code || '_api_secret_' || coalesce(v_owner_id::text, 'platform') || '_' || gen_random_uuid()::text);
    else
      perform vault.update_secret(v_secret_id, p_api_secret);
    end if;
  end if;

  if p_is_enabled and (v_key_id is null or v_secret_id is null) then
    raise exception 'CREDENTIALS_REQUIRED';
  end if;

  v_metadata := jsonb_build_object('api_key_secret_id', v_key_id, 'api_secret_secret_id', v_secret_id, 'market', coalesce(p_market, 'PH_MNL'));

  if v_existing.id is not null then
    update public.delivery_provider_accounts set
      is_enabled = coalesce(p_is_enabled, is_enabled),
      priority = coalesce(p_priority, priority),
      metadata = v_metadata,
      updated_at = now()
    where id = v_existing.id;
  else
    insert into public.delivery_provider_accounts (owner_type, owner_id, provider_code, is_enabled, priority, metadata)
    values (v_owner_type, v_owner_id, p_provider_code, coalesce(p_is_enabled, false), coalesce(p_priority, 100), v_metadata);
  end if;

  return jsonb_build_object(
    'market', coalesce(p_market, 'PH_MNL'),
    'is_enabled', coalesce(p_is_enabled, false),
    'has_credentials', v_key_id is not null and v_secret_id is not null
  );
end;
$$;

grant execute on function public.save_delivery_provider_account(text, text, text, text, text, boolean, int) to authenticated;

-- ---------------------------------------------------------------------
-- get_delivery_provider_account — read-back for the settings pages.
-- Never returns the decrypted secrets, only whether they're set.
-- ---------------------------------------------------------------------
create or replace function public.get_delivery_provider_account(p_owner_type text, p_provider_code text default 'lalamove')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner_type public.delivery_owner_type := p_owner_type::public.delivery_owner_type;
  v_owner_id uuid;
  v_result public.delivery_provider_accounts;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  if v_owner_type = 'platform' then
    if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
    v_owner_id := null;
  else
    v_owner_id := v_uid;
  end if;

  select * into v_result from public.delivery_provider_accounts
    where owner_type = v_owner_type and provider_code = p_provider_code
      and (owner_id = v_owner_id or (owner_id is null and v_owner_id is null));

  if v_result.id is null then
    return jsonb_build_object('market', 'PH_MNL', 'is_enabled', false, 'has_credentials', false);
  end if;

  return jsonb_build_object(
    'market', coalesce(v_result.metadata->>'market', 'PH_MNL'),
    'is_enabled', v_result.is_enabled,
    'priority', v_result.priority,
    'has_credentials', (v_result.metadata->>'api_key_secret_id') is not null and (v_result.metadata->>'api_secret_secret_id') is not null,
    'updated_at', v_result.updated_at
  );
end;
$$;

grant execute on function public.get_delivery_provider_account(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- get_delivery_provider_credentials — decrypts a specific account's
-- secrets. Service-role only, same as get_lalamove_credentials.
-- ---------------------------------------------------------------------
create or replace function public.get_delivery_provider_credentials(p_account_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, vault
as $$
  select jsonb_build_object(
    'api_key', k.decrypted_secret,
    'api_secret', s.decrypted_secret,
    'market', dpa.metadata->>'market'
  )
  from public.delivery_provider_accounts dpa
  left join vault.decrypted_secrets k on k.id = (dpa.metadata->>'api_key_secret_id')::uuid
  left join vault.decrypted_secrets s on s.id = (dpa.metadata->>'api_secret_secret_id')::uuid
  where dpa.id = p_account_id and dpa.is_enabled = true;
$$;

revoke all on function public.get_delivery_provider_credentials(uuid) from public, anon, authenticated;
grant execute on function public.get_delivery_provider_credentials(uuid) to service_role;

-- ---------------------------------------------------------------------
-- resolve_delivery_candidates — ranked accounts for an order: Merchant's
-- own, then the Reseller's, then the Platform's. Service-role only —
-- called from the delivery-quote / delivery-book Edge Functions, never
-- directly from a browser.
-- ---------------------------------------------------------------------
create or replace function public.resolve_delivery_candidates(p_order_id uuid)
returns setof public.delivery_provider_accounts
language sql
stable
security definer
set search_path = public
as $$
  select dpa.*
  from public.delivery_provider_accounts dpa
  join public.delivery_providers dp on dp.code = dpa.provider_code and dp.is_active
  join public.orders o on o.id = p_order_id
  where dpa.is_enabled
    and (
      (dpa.owner_type = 'merchant' and dpa.owner_id = o.merchant_id) or
      (dpa.owner_type = 'reseller' and dpa.owner_id = o.reseller_id) or
      (dpa.owner_type = 'platform')
    )
  order by
    case dpa.owner_type when 'merchant' then 1 when 'reseller' then 2 else 3 end,
    dpa.priority asc;
$$;

revoke all on function public.resolve_delivery_candidates(uuid) from public, anon, authenticated;
grant execute on function public.resolve_delivery_candidates(uuid) to service_role;

notify pgrst, 'reload schema';
