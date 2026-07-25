create extension if not exists pgcrypto;

create table if not exists public.user_device_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_device_id text not null,
  active_device_label text not null,
  pending_device_id text,
  pending_device_label text,
  pending_token_hash text,
  pending_status text check (pending_status in ('pending','approved','blocked')),
  requested_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_device_access enable row level security;
revoke all on public.user_device_access from anon, authenticated;

create or replace function public.request_device_access(p_device_id text, p_device_label text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_row public.user_device_access; v_token text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if length(trim(p_device_id)) < 16 then raise exception 'INVALID_DEVICE'; end if;
  select * into v_row from public.user_device_access where user_id=auth.uid() for update;
  if not found then
    insert into public.user_device_access(user_id,active_device_id,active_device_label)
    values(auth.uid(),left(p_device_id,100),left(trim(p_device_label),160));
    return jsonb_build_object('status','active');
  end if;
  if v_row.active_device_id=p_device_id then
    update public.user_device_access set active_device_label=left(trim(p_device_label),160),updated_at=now() where user_id=auth.uid();
    return jsonb_build_object('status','active');
  end if;
  if v_row.pending_device_id=p_device_id and v_row.pending_status='pending' then
    return jsonb_build_object('status','pending','active_label',v_row.active_device_label);
  end if;
  v_token:=encode(gen_random_bytes(32),'hex');
  update public.user_device_access set pending_device_id=left(p_device_id,100),pending_device_label=left(trim(p_device_label),160),
    pending_token_hash=encode(digest(v_token,'sha256'),'hex'),pending_status='pending',requested_at=now(),updated_at=now()
  where user_id=auth.uid();
  return jsonb_build_object('status','notify','token',v_token,'active_label',v_row.active_device_label);
end $$;

create or replace function public.get_device_access(p_device_id text)
returns jsonb language sql security definer set search_path=public as $$
  select case
    when auth.uid() is null then jsonb_build_object('status','signed_out')
    when d.active_device_id=p_device_id then jsonb_build_object('status','active','pending_label',case when d.pending_status='pending' then d.pending_device_label end)
    when d.pending_device_id=p_device_id then jsonb_build_object('status',coalesce(d.pending_status,'blocked'),'active_label',d.active_device_label)
    else jsonb_build_object('status','replaced')
  end
  from public.user_device_access d where d.user_id=auth.uid()
$$;

create or replace function public.resolve_device_access(p_action text, p_token text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_row public.user_device_access;
begin
  select * into v_row from public.user_device_access
  where pending_status='pending' and requested_at>now()-interval '20 minutes'
    and pending_token_hash=encode(digest(p_token,'sha256'),'hex') for update;
  if not found then return jsonb_build_object('status','expired'); end if;
  if p_action='approve' then
    update public.user_device_access set active_device_id=pending_device_id,active_device_label=pending_device_label,
      pending_status='approved',pending_token_hash=null,updated_at=now() where user_id=v_row.user_id;
    return jsonb_build_object('status','approved');
  elsif p_action='block' then
    update public.user_device_access set pending_status='blocked',pending_token_hash=null,updated_at=now() where user_id=v_row.user_id;
    return jsonb_build_object('status','blocked');
  end if;
  return jsonb_build_object('status','invalid');
end $$;

create or replace function public.resolve_my_device_request(p_device_id text, p_action text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_row public.user_device_access;
begin
  select * into v_row from public.user_device_access where user_id=auth.uid() and active_device_id=p_device_id for update;
  if not found or v_row.pending_status<>'pending' then return jsonb_build_object('status','missing'); end if;
  if p_action='approve' then
    update public.user_device_access set active_device_id=pending_device_id,active_device_label=pending_device_label,pending_status='approved',pending_token_hash=null,updated_at=now() where user_id=auth.uid();
    return jsonb_build_object('status','approved');
  end if;
  update public.user_device_access set pending_status='blocked',pending_token_hash=null,updated_at=now() where user_id=auth.uid();
  return jsonb_build_object('status','blocked');
end $$;

grant execute on function public.request_device_access(text,text) to authenticated;
grant execute on function public.get_device_access(text) to authenticated;
grant execute on function public.resolve_my_device_request(text,text) to authenticated;
grant execute on function public.resolve_device_access(text,text) to anon,authenticated;
