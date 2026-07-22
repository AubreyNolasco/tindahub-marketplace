-- Keep admin-created top-up references unique even when several requests are
-- created at the same moment. The payment reference registry trigger performs
-- the final database-level uniqueness check.
create or replace function public.admin_manual_topup(
  p_owner_id uuid,
  p_amount numeric,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id uuid;
  v_request_id uuid;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_amount <= 0 or p_amount > 1000000 then raise exception 'INVALID_AMOUNT'; end if;
  if not exists (
    select 1 from profiles
    where id = p_owner_id and role in ('merchant', 'reseller')
  ) then raise exception 'INVALID_ACCOUNT'; end if;

  insert into wallets(owner_id, balance)
  values (p_owner_id, 0)
  on conflict(owner_id) do nothing;

  select id into v_wallet_id
  from wallets
  where owner_id = p_owner_id
  for update;

  update wallets
  set balance = balance + p_amount, updated_at = now()
  where id = v_wallet_id;

  insert into wallet_transactions(wallet_id, amount, type, description)
  values (
    v_wallet_id,
    p_amount,
    'credit',
    'Admin manual top-up' || case
      when nullif(trim(p_note), '') is null then ''
      else ': ' || left(trim(p_note), 500)
    end
  );

  insert into topup_requests(
    owner_id,
    amount,
    method,
    reference_number,
    status,
    admin_notes,
    reviewed_by,
    reviewed_at
  )
  values (
    p_owner_id,
    p_amount,
    'bank_transfer',
    'ADMIN-' || upper(replace(gen_random_uuid()::text, '-', '')),
    'approved',
    left(p_note, 1000),
    auth.uid(),
    now()
  )
  returning id into v_request_id;

  return v_request_id;
end;
$$;

grant execute on function public.admin_manual_topup(uuid, numeric, text) to authenticated;

notify pgrst, 'reload schema';
