-- =====================================================================
-- Integration Scaffolding — Phase 1
--
-- Generalizes the pattern already proven by delivery_provider_accounts /
-- delivery_providers (see 20260801000200/300) to every future third-party
-- integration (payments, SMS, push, AI, OCR, analytics...), without
-- touching either of those tables or anything else in the schema.
--
-- Unlike delivery — which is per-owner (Merchant/Reseller/Platform can
-- each hold their own courier account) — these integrations are
-- platform-level: one PayMongo account, one OpenAI key, not one per
-- Reseller. So this is a single-row-per-integration config table rather
-- than delivery's multi-owner shape.
--
-- Credentials still never touch a plaintext column: `credentials_ref`
-- stores a jsonb map of named Vault secret ids (e.g.
-- {"api_key": "<vault-uuid>", "public_key": "<vault-uuid>"}), because
-- different integrations need a different number/shape of secrets
-- (a payment gateway needs a public+secret key pair, an SMS provider
-- needs one API key, delivery already showed two is not universal).
-- =====================================================================

create table if not exists public.integration_configs (
  key text primary key,
  label text not null,
  enabled boolean not null default false,
  mode text not null default 'sandbox' check (mode in ('sandbox', 'production')),
  credentials_ref jsonb not null default '{}',
  webhook_secret_ref uuid,
  metadata jsonb not null default '{}',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.integration_configs enable row level security;

drop policy if exists "integration_configs_admin_read" on public.integration_configs;
create policy "integration_configs_admin_read" on public.integration_configs
  for select to authenticated using (public.is_admin());

-- No insert/update/delete grants on the table itself — all writes go
-- through save_integration_config() below, same convention as
-- delivery_provider_accounts / save_delivery_provider_account.
grant select on public.integration_configs to authenticated;

-- Seed disabled placeholder rows for the integrations reviewed in the
-- architecture doc, so the Settings -> Integrations screen has
-- something to render without requiring a migration per integration.
-- Enabling any of these still requires an admin to supply real
-- credentials through save_integration_config().
insert into public.integration_configs (key, label) values
  ('payments.paymongo', 'PayMongo'),
  ('payments.maya', 'Maya'),
  ('payments.gcash', 'GCash'),
  ('payments.stripe', 'Stripe'),
  ('payments.paypal', 'PayPal'),
  ('sms.semaphore', 'Semaphore SMS'),
  ('push.firebase', 'Firebase Cloud Messaging'),
  ('ai.openai', 'OpenAI (JomBits enhancement)'),
  ('ocr.google_vision', 'Google Vision (permit OCR)'),
  ('analytics.google', 'Google Analytics')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- integration_event_logs — every outbound call and inbound webhook,
-- across every provider, in one place. Append-only from the edge-function
-- side (service_role); admins can read for the Integrations -> Logs tab.
-- ---------------------------------------------------------------------
create table if not exists public.integration_event_logs (
  id bigint generated always as identity primary key,
  integration_key text not null references public.integration_configs(key),
  direction text not null check (direction in ('outbound', 'inbound')),
  event_type text not null,
  status text not null check (status in ('success', 'error', 'retry')),
  payload jsonb not null default '{}',
  error_message text,
  created_at timestamptz not null default now()
);
create index if not exists integration_event_logs_key_idx on public.integration_event_logs(integration_key, created_at desc);

alter table public.integration_event_logs enable row level security;

drop policy if exists "integration_event_logs_admin_read" on public.integration_event_logs;
create policy "integration_event_logs_admin_read" on public.integration_event_logs
  for select to authenticated using (public.is_admin());

revoke all on public.integration_event_logs from anon, authenticated;
grant select on public.integration_event_logs to authenticated;
grant insert on public.integration_event_logs to service_role;

-- ---------------------------------------------------------------------
-- notifications — additive, parallel to the existing derived-feed
-- approach in RoleNotifications.jsx / AdminNotifications.jsx. Those
-- components keep working exactly as they do today; this just gives new
-- integration events (e.g. "PayMongo payment failed") somewhere to write
-- when there's no natural source row to derive a notification from.
-- Modeled on capture_activity_audit()'s security-definer convention.
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  category text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists notifications_owner_idx on public.notifications(owner_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_owner_read" on public.notifications;
create policy "notifications_owner_read" on public.notifications
  for select to authenticated using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "notifications_owner_mark_read" on public.notifications;
create policy "notifications_owner_mark_read" on public.notifications
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

revoke insert, delete on public.notifications from authenticated, anon;
grant select, update on public.notifications to authenticated;

create or replace function public.create_notification(
  p_owner_id uuid,
  p_category text,
  p_title text,
  p_body text default null,
  p_link text default null,
  p_metadata jsonb default '{}'
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  insert into public.notifications (owner_id, category, title, body, link, metadata)
  values (p_owner_id, p_category, p_title, p_body, p_link, coalesce(p_metadata, '{}'))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.create_notification(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_notification(uuid, text, text, text, text, jsonb) to service_role;

-- ---------------------------------------------------------------------
-- save_integration_config — one RPC for every integration key. Admin
-- only. Accepts a named jsonb map of credential values; each named
-- value gets its own Vault secret, created on first save and updated on
-- change, mirroring save_delivery_provider_account's create-or-update
-- logic but generalized to an arbitrary number of named secrets instead
-- of a fixed api_key/api_secret pair.
-- ---------------------------------------------------------------------
create or replace function public.save_integration_config(
  p_key text,
  p_enabled boolean default null,
  p_mode text default null,
  p_credentials jsonb default null,
  p_webhook_secret text default null,
  p_metadata jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_existing public.integration_configs;
  v_credentials_ref jsonb;
  v_cred_key text;
  v_cred_value text;
  v_secret_id uuid;
  v_webhook_secret_ref uuid;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;

  select * into v_existing from public.integration_configs where key = p_key;
  if v_existing.key is null then raise exception 'UNKNOWN_INTEGRATION_KEY'; end if;

  v_credentials_ref := coalesce(v_existing.credentials_ref, '{}'::jsonb);

  if p_credentials is not null then
    for v_cred_key, v_cred_value in select * from jsonb_each_text(p_credentials) loop
      if v_cred_value is not null and length(trim(v_cred_value)) > 0 then
        v_secret_id := nullif(v_credentials_ref->>v_cred_key, '')::uuid;
        if v_secret_id is null then
          v_secret_id := vault.create_secret(v_cred_value, p_key || '_' || v_cred_key || '_' || gen_random_uuid()::text);
        else
          perform vault.update_secret(v_secret_id, v_cred_value);
        end if;
        v_credentials_ref := jsonb_set(v_credentials_ref, array[v_cred_key], to_jsonb(v_secret_id::text));
      end if;
    end loop;
  end if;

  v_webhook_secret_ref := v_existing.webhook_secret_ref;
  if p_webhook_secret is not null and length(trim(p_webhook_secret)) > 0 then
    if v_webhook_secret_ref is null then
      v_webhook_secret_ref := vault.create_secret(p_webhook_secret, p_key || '_webhook_secret_' || gen_random_uuid()::text);
    else
      perform vault.update_secret(v_webhook_secret_ref, p_webhook_secret);
    end if;
  end if;

  update public.integration_configs set
    enabled = coalesce(p_enabled, enabled),
    mode = coalesce(p_mode, mode),
    credentials_ref = v_credentials_ref,
    webhook_secret_ref = v_webhook_secret_ref,
    metadata = coalesce(p_metadata, metadata),
    updated_by = auth.uid(),
    updated_at = now()
  where key = p_key;

  return jsonb_build_object(
    'key', p_key,
    'enabled', coalesce(p_enabled, v_existing.enabled),
    'mode', coalesce(p_mode, v_existing.mode),
    'has_credentials', v_credentials_ref <> '{}'::jsonb
  );
end;
$$;

revoke all on function public.save_integration_config(text, boolean, text, jsonb, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_integration_config(text, boolean, text, jsonb, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- get_integration_configs — read-back for the Settings -> Integrations
-- screen. Never returns decrypted secrets, only whether each named
-- credential is set.
-- ---------------------------------------------------------------------
create or replace function public.get_integration_configs()
returns table (
  key text,
  label text,
  enabled boolean,
  mode text,
  credential_names text[],
  has_webhook_secret boolean,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ic.key, ic.label, ic.enabled, ic.mode,
    coalesce(array(select jsonb_object_keys(ic.credentials_ref)), array[]::text[]),
    ic.webhook_secret_ref is not null,
    ic.updated_at
  from public.integration_configs ic
  where public.is_admin()
  order by ic.key;
$$;

grant execute on function public.get_integration_configs() to authenticated;

-- ---------------------------------------------------------------------
-- get_integration_credentials — decrypts one integration's secrets.
-- Service-role only, same convention as get_delivery_provider_credentials.
-- ---------------------------------------------------------------------
create or replace function public.get_integration_credentials(p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, vault
as $$
declare
  v_config public.integration_configs;
  v_result jsonb := '{}'::jsonb;
  v_cred_key text;
  v_secret_id text;
  v_webhook_secret text;
begin
  select * into v_config from public.integration_configs where key = p_key and enabled = true;
  if v_config.key is null then return null; end if;

  for v_cred_key, v_secret_id in select * from jsonb_each_text(v_config.credentials_ref) loop
    select decrypted_secret into v_webhook_secret from vault.decrypted_secrets where id = v_secret_id::uuid;
    v_result := jsonb_set(v_result, array[v_cred_key], to_jsonb(v_webhook_secret));
  end loop;

  if v_config.webhook_secret_ref is not null then
    select decrypted_secret into v_webhook_secret from vault.decrypted_secrets where id = v_config.webhook_secret_ref;
    v_result := jsonb_set(v_result, array['webhook_secret'], to_jsonb(v_webhook_secret));
  end if;

  return jsonb_build_object('mode', v_config.mode, 'credentials', v_result);
end;
$$;

revoke all on function public.get_integration_credentials(text) from public, anon, authenticated;
grant execute on function public.get_integration_credentials(text) to service_role;

-- ---------------------------------------------------------------------
-- log_integration_event — single write path for integration_event_logs,
-- called from edge functions with the service-role key.
-- ---------------------------------------------------------------------
create or replace function public.log_integration_event(
  p_integration_key text,
  p_direction text,
  p_event_type text,
  p_status text,
  p_payload jsonb default '{}',
  p_error_message text default null
)
returns bigint
language sql
security definer
set search_path = public
as $$
  insert into public.integration_event_logs (integration_key, direction, event_type, status, payload, error_message)
  values (p_integration_key, p_direction, p_event_type, p_status, coalesce(p_payload, '{}'), p_error_message)
  returning id;
$$;

revoke all on function public.log_integration_event(text, text, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.log_integration_event(text, text, text, text, jsonb, text) to service_role;

notify pgrst, 'reload schema';
