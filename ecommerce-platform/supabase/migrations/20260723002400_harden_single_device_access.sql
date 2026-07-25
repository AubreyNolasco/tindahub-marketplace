create or replace function public.request_device_access(p_device_id text, p_device_label text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_row public.user_device_access; v_token text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if length(trim(p_device_id)) < 16 or length(trim(p_device_id)) > 100 then raise exception 'INVALID_DEVICE'; end if;
  if length(trim(p_device_label)) < 3 then raise exception 'INVALID_DEVICE_LABEL'; end if;
  select * into v_row from public.user_device_access where user_id=auth.uid() for update;
  if not found then
    insert into public.user_device_access(user_id,active_device_id,active_device_label)
    values(auth.uid(),left(trim(p_device_id),100),left(trim(p_device_label),160));
    return jsonb_build_object('status','active');
  end if;
  if v_row.active_device_id=p_device_id then
    update public.user_device_access set active_device_label=left(trim(p_device_label),160),updated_at=now() where user_id=auth.uid();
    return jsonb_build_object('status','active');
  end if;
  if v_row.pending_status='pending' and v_row.requested_at>now()-interval '2 minutes' then
    return jsonb_build_object('status',case when v_row.pending_device_id=p_device_id then 'pending' else 'rate_limited' end,'active_label',v_row.active_device_label);
  end if;
  v_token:=encode(gen_random_bytes(32),'hex');
  update public.user_device_access set pending_device_id=left(trim(p_device_id),100),pending_device_label=left(trim(p_device_label),160),
    pending_token_hash=encode(digest(v_token,'sha256'),'hex'),pending_status='pending',requested_at=now(),updated_at=now()
  where user_id=auth.uid();
  return jsonb_build_object('status','notify','token',v_token,'active_label',v_row.active_device_label);
end $$;

create or replace function public.validate_my_device_email_token(p_token text)
returns boolean language sql security definer set search_path=public,extensions as $$
  select exists(select 1 from public.user_device_access
    where user_id=auth.uid() and pending_status='pending' and requested_at>now()-interval '20 minutes'
      and pending_token_hash=encode(digest(p_token,'sha256'),'hex'))
$$;

grant execute on function public.validate_my_device_email_token(text) to authenticated;
